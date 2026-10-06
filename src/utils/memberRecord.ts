import { differenceInCalendarDays, differenceInMonths, differenceInYears, format } from "date-fns";
import { dbQuery } from "@/lib/db";
import { parseLocalDate, syncLoanPenalties } from "@/hooks/useLoans";
import { dueIn, loanDueDate } from "@/utils/loanPenalty";
import { loanIncome, type LoanIncome } from "@/utils/loanInterest";
import type { DbMember } from "@/hooks/useMembers";
import { attendanceStatus, type AttendanceStatus } from "@/hooks/useAttendance";
import type { Settings } from "@/contexts/SettingsContext";
import { figureBlock, footer, heading, letterhead } from "@/utils/whatsappFormat";

export type LoanState = "Active" | "Overdue" | "Paid" | "Defaulted";

export interface MemberLoan {
  id: string;
  date: string;
  principal: number;
  interestRate: number;
  totalPayable: number;
  /** The bank's charge on the withdrawal, repaid with the loan (no interest on it). */
  bankCharge: number;
  repaid: number;
  remaining: number;
  termMonths: number;
  /** One year after issue. */
  dueDate: string;
  penaltyPerMonth: number;
  /** Late penalties charged so far (included in `remaining`). */
  penaltyTotal: number;
  state: LoanState;
  /** The day the committee marked it defaulted (null if it hasn't been). */
  defaultedOn: string | null;
  /** Everything owed once the due date has passed; 0 before it. */
  arrears: number;
  /** Days since the due date. */
  daysOverdue: number;
  /** Until the due date, for an active loan: "5 months left" (there is no instalment plan). */
  timeLeft: string | null;
  repayments: { date: string; amount: number }[];
  /** Interest and late penalties: charged, received, outstanding. */
  income: LoanIncome;
}

export interface SavingsEntry {
  date: string;
  /** "opening": the savings balance brought forward from the paper registers at the cut-over. */
  kind: "contribution" | "profit" | "opening";
  amount: number;
  /** Attendance at the meeting the contribution was collected in (null when not recorded / not a meeting). */
  attendance: AttendanceStatus | null;
  /** Balance after this entry. */
  balance: number;
}

/** Everything shown in the Member Details dialog, loaded fresh from the database. */
export interface MemberRecord {
  member: DbMember;
  savingsBalance: number;
  contributionsTotal: number;
  profitTotal: number;
  /** Newest first. */
  savings: SavingsEntry[];
  /** The member's most recent dividend, as saved with its distribution (null if none yet). */
  lastDividend: { amount: number; date: string; year: number | null; ratio: number | null } | null;
  /** Newest first. */
  loans: MemberLoan[];
  loanOutstanding: number;
  openLoans: number;
  /** Meetings (since the member joined) with attendance recorded, and how many they attended. */
  attended: number;
  /** Not counting the meetings they were on leave for (excused). */
  recordedMeetings: number;
  onLeaveMeetings: number;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const todayKey = () => format(new Date(), "yyyy-MM-dd");

export async function getMemberRecord(memberId: string): Promise<MemberRecord> {
  await syncLoanPenalties();
  const [memberRows, contributions, profits, loans, installments, meetings] = await Promise.all([
    dbQuery<DbMember>("SELECT * FROM public.members WHERE id = $1", [memberId]),
    dbQuery<{ amount: number; contribution_date: string; present: boolean | null; on_leave: boolean | null; created_at: string; is_opening: boolean }>(
      `SELECT c.amount, c.contribution_date::text AS contribution_date, a.present, a.on_leave, c.created_at::text AS created_at, c.is_opening
       FROM public.monthly_contributions c
       LEFT JOIN public.attendance a ON a.meeting_id = c.meeting_id AND a.member_id = c.member_id
       WHERE c.member_id = $1`,
      [memberId],
    ),
    dbQuery<{ amount: number; distribution_date: string; ratio: number | null; profit_year: number | null }>(
      `SELECT a.amount, d.distribution_date::text AS distribution_date, a.ratio, d.profit_year FROM public.profit_allocations a
       JOIN public.profit_distributions d ON d.id = a.distribution_id WHERE a.member_id = $1
       ORDER BY d.distribution_date, d.created_at`,
      [memberId],
    ),
    dbQuery<{ id: string; loan_date: string; amount: number; interest_rate: number; total_payable: number; bank_charge: number; remaining_amount: number; term_months: number; penalty_per_month: number; penalty_total: number; status: string; defaulted_on: string | null }>(
      `SELECT l.id, l.loan_date::text AS loan_date, l.amount, l.interest_rate, l.total_payable, l.bank_charge, l.remaining_amount, l.term_months, l.penalty_per_month,
              COALESCE((SELECT SUM(p.amount) FROM public.loan_penalties p WHERE p.loan_id = l.id), 0) AS penalty_total, l.status, l.defaulted_on::text AS defaulted_on
       FROM public.loans l WHERE l.member_id = $1 ORDER BY l.loan_date DESC, l.created_at DESC`,
      [memberId],
    ),
    dbQuery<{ loan_id: string; amount: number; payment_date: string }>(
      `SELECT i.loan_id, i.amount, i.payment_date::text AS payment_date FROM public.loan_installments i
       JOIN public.loans l ON l.id = i.loan_id WHERE l.member_id = $1 ORDER BY i.payment_date, i.created_at`,
      [memberId],
    ),
    dbQuery<{ present: boolean | null; on_leave: boolean | null }>(
      `SELECT a.present, a.on_leave FROM public.meetings mt
       JOIN public.members m ON m.id = $1
       LEFT JOIN public.attendance a ON a.meeting_id = mt.id AND a.member_id = m.id
       WHERE mt.meeting_date >= m.join_date OR a.id IS NOT NULL`,
      [memberId],
    ),
  ]);

  const member = memberRows[0];
  if (!member) throw new Error("Member not found");

  // Savings account: contributions and profit shares, oldest first for the running balance.
  const entries = [
    ...contributions.map((c) => ({ date: c.contribution_date, kind: c.is_opening ? ("opening" as const) : ("contribution" as const), amount: Number(c.amount), attendance: c.present === null ? null : attendanceStatus({ present: c.present, on_leave: c.on_leave }), order: c.is_opening ? "" : c.created_at })),
    ...profits.map((p) => ({ date: p.distribution_date, kind: "profit" as const, amount: Number(p.amount), attendance: null, order: "~" })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));
  let running = 0;
  const savings: SavingsEntry[] = entries.map((e) => {
    running = r2(running + e.amount);
    return { date: e.date, kind: e.kind, amount: e.amount, attendance: e.attendance, balance: running };
  });
  const contributionsTotal = r2(contributions.reduce((s, c) => s + Number(c.amount), 0));
  const profitTotal = r2(profits.reduce((s, p) => s + Number(p.amount), 0));

  const today = todayKey();
  const memberLoans: MemberLoan[] = loans.map((l) => {
    const totalPayable = Number(l.total_payable) || Number(l.amount);
    const bankCharge = r2(Number(l.bank_charge) || 0);
    const penaltyTotal = r2(Number(l.penalty_total) || 0);
    const remaining = Math.max(0, r2(Number(l.remaining_amount)));
    const repayments = installments.filter((i) => i.loan_id === l.id).map((i) => ({ date: i.payment_date, amount: Number(i.amount) }));
    const dueDate = loanDueDate(l.loan_date);
    // There is no instalment plan: a loan is repaid in any amounts, and only the due date makes it overdue.
    const pastDue = dueDate < today;
    const status = String(l.status).toLowerCase();
    const state: LoanState =
      status === "defaulted" ? "Defaulted" : remaining <= 0.005 || status === "paid" ? "Paid" : pastDue ? "Overdue" : "Active";
    return {
      id: l.id,
      date: l.loan_date,
      principal: Number(l.amount),
      interestRate: Number(l.interest_rate) || 0,
      totalPayable,
      bankCharge,
      repaid: r2(totalPayable + bankCharge + penaltyTotal - remaining),
      remaining,
      termMonths: l.term_months || 1,
      dueDate,
      penaltyPerMonth: Number(l.penalty_per_month) || 0,
      penaltyTotal,
      state,
      defaultedOn: l.defaulted_on ? l.defaulted_on.slice(0, 10) : null,
      arrears: state === "Paid" || !pastDue ? 0 : remaining,
      daysOverdue: state === "Paid" || !pastDue ? 0 : differenceInCalendarDays(parseLocalDate(today), parseLocalDate(dueDate)),
      timeLeft: state === "Active" ? dueIn(dueDate, today).text : null,
      repayments,
      income: loanIncome({ loanDate: l.loan_date, amount: Number(l.amount), totalPayable, bankCharge, remaining, penaltiesCharged: penaltyTotal, payments: repayments }),
    };
  });

  const recorded = meetings.filter((m) => m.present !== null);
  const onLeave = recorded.filter((m) => !m.present && m.on_leave).length;
  const last = profits[profits.length - 1];

  return {
    member,
    savingsBalance: r2(Number(member.total_budget) || 0),
    contributionsTotal,
    profitTotal,
    savings: savings.reverse(),
    lastDividend: last
      ? { amount: r2(Number(last.amount)), date: last.distribution_date, year: last.profit_year ?? null, ratio: last.ratio === null ? null : Number(last.ratio) }
      : null,
    loans: memberLoans,
    loanOutstanding: r2(memberLoans.filter((l) => l.state !== "Paid").reduce((s, l) => s + l.remaining, 0)),
    openLoans: memberLoans.filter((l) => l.state !== "Paid").length,
    attended: recorded.filter((m) => m.present).length,
    recordedMeetings: recorded.length - onLeave,
    onLeaveMeetings: onLeave,
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

/** WhatsApp summary sent to the member's own number (layout in utils/whatsappFormat.ts). */
export function formatMemberSummary(record: MemberRecord, settings: Pick<Settings, "organizationName" | "dateFormat" | "currency">): string {
  const cur = settings.currency || "PKR";
  const num = (v: number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const date = (key: string) => format(parseLocalDate(key.slice(0, 10)), settings.dateFormat || "dd/MM/yyyy");
  const today = format(new Date(), settings.dateFormat || "dd/MM/yyyy");
  const { member } = record;

  const out = [
    ...letterhead(settings, "Member Account Summary"),
    `Assalam-o-Alaikum *${member.name}*,`,
    `Here is your MSO account as at *${today}*.`,
    "",
    heading("Member"),
    member.name,
    ...(member.father_name ? [`Father's name: ${member.father_name}`] : []),
    `Member since ${date(member.join_date)} (${durationSince(member.join_date)})`,
    "",
    heading("Savings"),
    figureBlock([
      { label: "Contributions", amount: record.contributionsTotal },
      ...(record.profitTotal > 0 ? [{ label: "Profit shares", amount: record.profitTotal, sign: "+" as const }] : []),
      "rule",
      { label: "Balance", amount: record.savingsBalance, sign: "=" },
    ]),
  ];
  if (record.lastDividend) {
    const d = record.lastDividend;
    const share = d.ratio !== null ? ` (${(d.ratio * 100).toFixed(2)}% share)` : "";
    out.push(`Last dividend: ${num(d.amount)} ${d.year ? `for ${d.year}` : `on ${date(d.date)}`}${share}`);
  }

  // Each loan still owed, worked out as on the Loans page: lent + interest + charges − repaid.
  const open = record.loans.filter((l) => l.state !== "Paid");
  if (open.length === 0) out.push("", heading("Loans"), "No loan outstanding.");
  for (const l of open) {
    const interest = Math.round((l.totalPayable - l.principal) * 100) / 100;
    out.push(
      "",
      heading(`Loan of ${date(l.date)}`),
      figureBlock([
        { label: "Lent", amount: l.principal },
        ...(interest > 0.005 ? [{ label: `Interest (${l.interestRate}%)`, amount: interest, sign: "+" as const }] : []),
        ...(l.bankCharge > 0.005 ? [{ label: "Bank charge", amount: l.bankCharge, sign: "+" as const }] : []),
        ...(l.penaltyTotal > 0.005 ? [{ label: "Late penalties", amount: l.penaltyTotal, sign: "+" as const }] : []),
        { label: "Repaid", amount: l.repaid, sign: "-" },
        "rule",
        { label: "Outstanding", amount: l.remaining, sign: "=" },
      ]),
    );
    if (l.state === "Overdue") {
      const penalty = l.penaltyPerMonth > 0
        ? `A late penalty of ${num(l.penaltyPerMonth)} is added for each further full month it stays unpaid.`
        : "Please repay it as soon as you can.";
      out.push(`> ⚠️ *Overdue* since ${date(l.dueDate)} (${l.daysOverdue} days). ${penalty}`);
    } else if (l.state === "Defaulted") {
      out.push(`> ⚠️ *Defaulted*: marked by the committee${l.defaultedOn ? ` on ${date(l.defaultedOn)}` : ""}. The balance is still owed.`);
    } else {
      out.push(`Due by ${date(l.dueDate)}${l.timeLeft ? ` (${l.timeLeft})` : ""}. Repay in any amounts before then.`);
    }
  }
  if (open.length > 1) out.push("", `*Total outstanding: ${num(record.loanOutstanding)}*`);

  if (record.recordedMeetings) {
    const pct = Math.round((record.attended / record.recordedMeetings) * 100);
    const leave = record.onLeaveMeetings ? `, not counting ${record.onLeaveMeetings} on leave` : "";
    out.push("", heading("Attendance"), `${record.attended} of ${record.recordedMeetings} meetings attended (${pct}%)${leave}`);
  }

  out.push(...footer(`Prepared from MSO records on ${today}. If anything differs from your own record, please contact the administration.`));
  return out.join("\n");
}
