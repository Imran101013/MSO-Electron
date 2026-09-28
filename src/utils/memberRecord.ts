import { differenceInCalendarDays, differenceInMonths, differenceInYears, format } from "date-fns";
import { dbQuery } from "@/lib/db";
import { parseLocalDate, syncLoanPenalties } from "@/hooks/useLoans";
import { loanDueDate } from "@/utils/loanPenalty";
import type { DbMember } from "@/hooks/useMembers";
import type { Settings } from "@/contexts/SettingsContext";
import { memberNumber, registerOrder } from "@/utils/accounting";

export type LoanState = "Active" | "Overdue" | "Paid" | "Defaulted";

export interface MemberLoan {
  id: string;
  date: string;
  principal: number;
  interestRate: number;
  totalPayable: number;
  repaid: number;
  remaining: number;
  termMonths: number;
  /** One year after issue. */
  dueDate: string;
  penaltyPerMonth: number;
  /** Late penalties charged so far (included in `remaining`). */
  penaltyTotal: number;
  state: LoanState;
  /** Everything owed once the due date has passed; 0 before it. */
  arrears: number;
  /** Days since the due date. */
  daysOverdue: number;
  nextDue: { date: string; amount: number } | null;
  repayments: { date: string; amount: number }[];
}

export interface SavingsEntry {
  date: string;
  kind: "contribution" | "profit";
  amount: number;
  /** Attendance at the meeting the contribution was collected in (null when not recorded / not a meeting). */
  present: boolean | null;
  /** Balance after this entry. */
  balance: number;
}

/** Everything shown in the Member Details dialog, loaded fresh from the database. */
export interface MemberRecord {
  member: DbMember;
  memberNo: string;
  savingsBalance: number;
  contributionsTotal: number;
  profitTotal: number;
  /** Newest first. */
  savings: SavingsEntry[];
  /** Share of all members' contributions — the basis for profit distribution. */
  profitShareRatio: number | null;
  /** Newest first. */
  loans: MemberLoan[];
  loanOutstanding: number;
  openLoans: number;
  /** Meetings (since the member joined) with attendance recorded, and how many they attended. */
  attended: number;
  recordedMeetings: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayKey = () => format(new Date(), "yyyy-MM-dd");

export async function getMemberRecord(memberId: string): Promise<MemberRecord> {
  await syncLoanPenalties();
  const [memberRows, allMembers, contributions, profits, loans, installments, schedule, meetings, totals] = await Promise.all([
    dbQuery<DbMember>("SELECT * FROM public.members WHERE id = $1", [memberId]),
    dbQuery<{ id: string; name: string; join_date: string }>("SELECT id, name, join_date::text AS join_date FROM public.members"),
    dbQuery<{ amount: number; contribution_date: string; present: boolean | null; created_at: string }>(
      `SELECT c.amount, c.contribution_date::text AS contribution_date, a.present, c.created_at::text AS created_at
       FROM public.monthly_contributions c
       LEFT JOIN public.attendance a ON a.meeting_id = c.meeting_id AND a.member_id = c.member_id
       WHERE c.member_id = $1`,
      [memberId],
    ),
    dbQuery<{ amount: number; distribution_date: string }>(
      `SELECT a.amount, d.distribution_date::text AS distribution_date FROM public.profit_allocations a
       JOIN public.profit_distributions d ON d.id = a.distribution_id WHERE a.member_id = $1`,
      [memberId],
    ),
    dbQuery<{ id: string; loan_date: string; amount: number; interest_rate: number; total_payable: number; remaining_amount: number; term_months: number; penalty_per_month: number; penalty_total: number; status: string }>(
      `SELECT l.id, l.loan_date::text AS loan_date, l.amount, l.interest_rate, l.total_payable, l.remaining_amount, l.term_months, l.penalty_per_month,
              COALESCE((SELECT SUM(p.amount) FROM public.loan_penalties p WHERE p.loan_id = l.id), 0) AS penalty_total, l.status
       FROM public.loans l WHERE l.member_id = $1 ORDER BY l.loan_date DESC, l.created_at DESC`,
      [memberId],
    ),
    dbQuery<{ loan_id: string; amount: number; payment_date: string }>(
      `SELECT i.loan_id, i.amount, i.payment_date::text AS payment_date FROM public.loan_installments i
       JOIN public.loans l ON l.id = i.loan_id WHERE l.member_id = $1 ORDER BY i.payment_date, i.created_at`,
      [memberId],
    ),
    dbQuery<{ loan_id: string; due_date: string; due_amount: number; paid_amount: number; status: string }>(
      `SELECT s.loan_id, s.due_date::text AS due_date, s.due_amount, s.paid_amount, s.status FROM public.loan_schedule s
       JOIN public.loans l ON l.id = s.loan_id WHERE l.member_id = $1 ORDER BY s.installment_number`,
      [memberId],
    ),
    dbQuery<{ present: boolean | null }>(
      `SELECT a.present FROM public.meetings mt
       JOIN public.members m ON m.id = $1
       LEFT JOIN public.attendance a ON a.meeting_id = mt.id AND a.member_id = m.id
       WHERE mt.meeting_date >= m.join_date OR a.id IS NOT NULL`,
      [memberId],
    ),
    dbQuery<{ total: number }>("SELECT COALESCE(SUM(amount), 0) AS total FROM public.monthly_contributions"),
  ]);

  const member = memberRows[0];
  if (!member) throw new Error("Member not found");

  const ordered = [...allMembers].sort((a, b) =>
    registerOrder({ join: a.join_date, name: a.name, id: a.id }, { join: b.join_date, name: b.name, id: b.id }),
  );
  const memberNo = memberNumber(Math.max(0, ordered.findIndex((m) => m.id === memberId)));

  // Savings account: contributions and profit shares, oldest first for the running balance.
  const entries = [
    ...contributions.map((c) => ({ date: c.contribution_date, kind: "contribution" as const, amount: Number(c.amount), present: c.present, order: c.created_at })),
    ...profits.map((p) => ({ date: p.distribution_date, kind: "profit" as const, amount: Number(p.amount), present: null, order: "~" })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));
  let running = 0;
  const savings: SavingsEntry[] = entries.map((e) => {
    running = r2(running + e.amount);
    return { date: e.date, kind: e.kind, amount: e.amount, present: e.present, balance: running };
  });
  const contributionsTotal = r2(contributions.reduce((s, c) => s + Number(c.amount), 0));
  const profitTotal = r2(profits.reduce((s, p) => s + Number(p.amount), 0));

  const today = todayKey();
  const memberLoans: MemberLoan[] = loans.map((l) => {
    const totalPayable = Number(l.total_payable) || Number(l.amount);
    const penaltyTotal = r2(Number(l.penalty_total) || 0);
    const remaining = Math.max(0, r2(Number(l.remaining_amount)));
    const dueDate = loanDueDate(l.loan_date);
    // Instalments are a guide (a lump sum before the due date is fine), so only the due date makes a loan overdue.
    const pastDue = dueDate < today;
    const rows = schedule.filter((s) => s.loan_id === l.id).map((s) => ({ ...s, balance: r2(Number(s.due_amount) - Number(s.paid_amount)) }));
    const nextRow = rows.find((s) => s.balance > 0.005 && s.due_date >= today);
    const next = nextRow ? { date: nextRow.due_date, amount: nextRow.balance } : pastDue ? null : { date: dueDate, amount: remaining };
    const status = String(l.status).toLowerCase();
    const state: LoanState =
      status === "defaulted" ? "Defaulted" : remaining <= 0.005 || status === "paid" ? "Paid" : pastDue ? "Overdue" : "Active";
    return {
      id: l.id,
      date: l.loan_date,
      principal: Number(l.amount),
      interestRate: Number(l.interest_rate) || 0,
      totalPayable,
      repaid: r2(totalPayable + penaltyTotal - remaining),
      remaining,
      termMonths: l.term_months || 1,
      dueDate,
      penaltyPerMonth: Number(l.penalty_per_month) || 0,
      penaltyTotal,
      state,
      arrears: state === "Paid" || !pastDue ? 0 : remaining,
      daysOverdue: state === "Paid" || !pastDue ? 0 : differenceInCalendarDays(parseLocalDate(today), parseLocalDate(dueDate)),
      nextDue: state === "Paid" || !next ? null : next,
      repayments: installments.filter((i) => i.loan_id === l.id).map((i) => ({ date: i.payment_date, amount: Number(i.amount) })),
    };
  });

  const recorded = meetings.filter((m) => m.present !== null);
  const allContributions = Number(totals[0]?.total) || 0;

  return {
    member,
    memberNo,
    savingsBalance: r2(Number(member.total_budget) || 0),
    contributionsTotal,
    profitTotal,
    savings: savings.reverse(),
    profitShareRatio: allContributions > 0 ? contributionsTotal / allContributions : null,
    loans: memberLoans,
    loanOutstanding: r2(memberLoans.filter((l) => l.state !== "Paid").reduce((s, l) => s + l.remaining, 0)),
    openLoans: memberLoans.filter((l) => l.state !== "Paid").length,
    attended: recorded.filter((m) => m.present).length,
    recordedMeetings: recorded.length,
  };
}

/** "2 yrs 3 mos" / "5 mos" / "less than a month" since the given yyyy-MM-dd date. */
export function durationSince(key: string): string {
  const start = parseLocalDate(key.slice(0, 10));
  const months = differenceInMonths(new Date(), start);
  if (months < 1) return "less than a month";
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  return [y ? part(y, "yr") : "", m ? part(m, "mo") : ""].filter(Boolean).join(" ");
}

export const ageFrom = (dob: string | null) => (dob ? differenceInYears(new Date(), parseLocalDate(dob.slice(0, 10))) : null);

/** WhatsApp summary sent to the member's own number. */
export function formatMemberSummary(record: MemberRecord, settings: Pick<Settings, "organizationName" | "dateFormat" | "currency">): string {
  const cur = settings.currency || "PKR";
  const num = (v: number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const date = (key: string) => format(parseLocalDate(key.slice(0, 10)), settings.dateFormat || "dd/MM/yyyy");
  const orgName =
    settings.organizationName?.trim() && settings.organizationName.trim().toUpperCase() !== "MSO"
      ? settings.organizationName.trim()
      : "Mogh Students Organisation";
  const { member } = record;
  const out = [
    `*${orgName} (MSO)*`,
    "*Member account summary*",
    "",
    `Name: ${member.name} (${record.memberNo})`,
    ...(member.father_name ? [`Father's name: ${member.father_name}`] : []),
    `Member since: ${date(member.join_date)}`,
    "",
    `*Savings balance: ${cur} ${num(record.savingsBalance)}*`,
    `Contributions: ${cur} ${num(record.contributionsTotal)}`,
    ...(record.profitTotal > 0 ? [`Profit shares: ${cur} ${num(record.profitTotal)}`] : []),
    "",
    record.openLoans
      ? `*Loan outstanding: ${cur} ${num(record.loanOutstanding)}*`
      : "*Loans:* none outstanding",
  ];
  for (const l of record.loans.filter((x) => x.state !== "Paid")) {
    const detail = l.state === "Overdue"
      ? `overdue since ${date(l.dueDate)} (${l.daysOverdue} days)${l.penaltyTotal > 0 ? `, incl. ${cur} ${num(l.penaltyTotal)} late penalty` : ""}`
      : l.state === "Defaulted"
        ? "defaulted"
        : `due by ${date(l.dueDate)}${l.nextDue && l.nextDue.date !== l.dueDate ? `, next instalment ${date(l.nextDue.date)}: ${cur} ${num(l.nextDue.amount)}` : ""}`;
    out.push(`- Loan of ${date(l.date)}: ${cur} ${num(l.remaining)} remaining, ${detail}`);
  }
  if (record.recordedMeetings) {
    out.push("", `*Attendance:* ${record.attended} of ${record.recordedMeetings} meetings (${Math.round((record.attended / record.recordedMeetings) * 100)}%)`);
  }
  return out.join("\n");
}
