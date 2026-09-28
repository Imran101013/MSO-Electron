/**
 * Derived double-entry ledger for MSO's records.
 *
 * The app stores operational rows (contributions, loans, installments, reserve
 * transactions, profit distributions) rather than journal entries. This module
 * turns those rows into a dated general ledger so every PDF report is produced
 * from one consistent set of balances — the Statement of Financial Position,
 * Trial Balance, Cash Book, and member/loan statements all agree by construction.
 *
 * Postings (Dr / Cr):
 *   Contribution received     Cash               / Members' savings
 *   Loan disbursed            Loans (total payable) / Cash (principal) + Interest income (flat interest)
 *   Late penalty charged      Loans              / Penalty income
 *   Loan repayment            Cash               / Loans (the whole repayment; never split)
 *   Reserve donation          Cash               / Reserve fund
 *   Reserve expense           Reserve fund       / Cash
 *   Bank profit received      Cash               / Bank profit income
 *   Profit to members         Accumulated surplus/ Members' savings
 *   Profit to reserve         Accumulated surplus/ Reserve fund
 *
 * Profit distributions share out the bank's annual profit on the funds held in the
 * account (entered on the Profit Distribution page). Each one is posted as bank profit
 * received and then fully appropriated — the reserve's share (set per distribution), the rest to members by contributions — so
 * it never draws on loan interest, which stays in the accumulated surplus.
 *   Impairment                Impairment expense / Allowance for loan losses
 *
 * Accounting policies applied (disclosed in the Financial Statements notes):
 * - Loans carry flat interest worked out once, when the loan is issued (loans.total_payable).
 *   That interest is income on the issue date, and the loan is carried at the balance the member
 *   owes. Repayments (instalments or a lump sum) only reduce that balance; they are never split
 *   between the amount lent, interest and penalties.
 * - Loans run for one year (utils/loanPenalty.ts). A loan still owing after that is overdue
 *   and aged from its due date; instalments missed within the year are not arrears, as the
 *   member may repay as a lump sum instead. Each monthly late penalty is added to the balance
 *   owed and taken to income when it is charged.
 * - A loan's interest and penalties count as received when the loan is repaid in full
 *   (utils/loanInterest.ts) — this drives the Interest & Penalties sections, not the postings.
 * - Loans flagged "defaulted" are provided for in full (100% of the balance still owed, which
 *   includes interest and penalties already taken to income).
 */
import { addDays, addMonths, differenceInCalendarDays, format } from "date-fns";
import { loanDueDate } from "@/utils/loanPenalty";
import { paidInFullOn } from "@/utils/loanInterest";
import type {
  Member,
  Meeting,
  ProfitDistribution,
  ReserveTransaction,
} from "@/contexts/OrganizationContext";

export interface AccountingInput {
  members: Member[];
  meetings: Meeting[];
  reserveTransactions: ReserveTransaction[];
  profitDistributions: ProfitDistribution[];
}

/** Inclusive reporting period as yyyy-MM-dd keys; `from: null` means since inception. */
export interface ReportPeriod {
  from: string | null;
  to: string;
}

export const EPS = 0.005;

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const sum = <T>(items: T[], pick: (t: T) => number) =>
  r2(items.reduce((s, t) => s + (pick(t) || 0), 0));

/** Normalises a DB date string or Date into a local yyyy-MM-dd key (no UTC shift). */
export function dayKey(d: string | Date): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return format(new Date(d), "yyyy-MM-dd");
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const dayBefore = (key: string) => format(addDays(parseDay(key), -1), "yyyy-MM-dd");

export const todayKey = () => format(new Date(), "yyyy-MM-dd");

const inPeriod = (date: string, p: ReportPeriod) =>
  (p.from === null || date >= p.from) && date <= p.to;

/** Closing date of the day before the period starts, or null when the period starts at inception. */
export const openingDate = (p: ReportPeriod) => (p.from ? dayBefore(p.from) : null);

// ───────────────────────── Members ─────────────────────────

export interface MemberRecord {
  memberNo: string;
  dbId: string;
  name: string;
  fatherName: string;
  phone: string;
  email: string;
  address: string;
  joinDate: string;
  /** Balance per the member master record (members.total_budget) — used as a control total. */
  masterBalance: number;
  source: Member;
}

// ───────────────────────── Loans ─────────────────────────

export type LoanState = "active" | "paid" | "defaulted";

export interface LoanReceipt {
  date: string;
  sourceId: string;
  amount: number;
  /** Balance owed after this receipt, including penalties charged up to its date. */
  balanceAfter: number;
  itemised: boolean;
  voucher: string;
}

export interface PenaltyRow {
  month: number;
  date: string;
  amount: number;
}

export interface ScheduleRow {
  no: number;
  dueDate: string;
  dueAmount: number;
}

export interface LoanRecord {
  loanNo: string;
  dbId: string;
  memberId: string;
  memberNo: string;
  memberName: string;
  date: string;
  principal: number;
  interestRate: number;
  interest: number;
  totalPayable: number;
  termMonths: number;
  state: LoanState;
  /** remaining_amount as stored on the loan row (includes penalties charged). */
  systemOutstanding: number;
  receipts: LoanReceipt[];
  schedule: ScheduleRow[];
  scheduleIsDerived: boolean;
  /** Date the loan must be repaid by: one year after disbursement. */
  maturityDate: string;
  penaltyPerMonth: number;
  /** Late penalties charged, oldest first. */
  penalties: PenaltyRow[];
  penaltyTotal: number;
  /** Date the loan was repaid in full, which is when its interest and penalties count as received (utils/loanInterest.ts). */
  paidInFullOn: string | null;
  disbursementVoucher: string;
}

export type AgingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+" | "defaulted";

export const AGING_LABELS: Record<AgingBucket, string> = {
  current: "Current (not overdue)",
  "1-30": "1 - 30 days past due",
  "31-60": "31 - 60 days past due",
  "61-90": "61 - 90 days past due",
  "90+": "Over 90 days past due",
  defaulted: "Defaulted (flagged)",
};

export interface ScheduleStatusRow extends ScheduleRow {
  paid: number;
  balance: number;
  status: "Paid" | "Part-paid" | "Due" | "Overdue";
  daysOverdue: number;
}

export interface LoanPosition {
  loan: LoanRecord;
  asAt: string;
  repaid: number;
  /** Balance owed: total payable + penalties charged by `asAt`, less repayments. */
  outstanding: number;
  /** The loan's interest once it is repaid in full by `asAt`, else 0. */
  interestReceived: number;
  /** Interest still inside `outstanding`. */
  interestOutstanding: number;
  penaltiesCharged: number;
  /** Penalties charged, once the loan is repaid in full by `asAt`; else 0. */
  penaltyReceived: number;
  penaltyOutstanding: number;
  /** Everything owed once the due date has passed; 0 before it. */
  arrears: number;
  daysPastDue: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  state: LoanState;
  bucket: AgingBucket | null;
  schedule: ScheduleStatusRow[];
}

function normaliseLoanState(status: string): LoanState {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "paid";
  if (s === "defaulted") return "defaulted";
  return "active";
}

// ───────────────────────── Ledger ─────────────────────────

export type EntryKind =
  | "contribution"
  | "repayment"
  | "donation"
  | "disbursement"
  | "expense"
  | "bank_profit"
  | "profit_member"
  | "profit_reserve"
  | "penalty_charge";

const KIND_ORDER: Record<EntryKind, number> = {
  contribution: 1,
  repayment: 2,
  donation: 3,
  disbursement: 4,
  expense: 5,
  bank_profit: 6,
  profit_member: 7,
  profit_reserve: 8,
  penalty_charge: 9,
};

export const KIND_LABELS: Record<EntryKind, string> = {
  contribution: "Member contribution",
  repayment: "Loan repayment",
  donation: "Reserve fund donation",
  disbursement: "Loan disbursement",
  expense: "Reserve fund expense",
  bank_profit: "Bank profit received",
  profit_member: "Bank profit share to member",
  profit_reserve: "Bank profit share to reserve fund",
  penalty_charge: "Late payment penalty charged",
};

/** Before 20/07/2026 the app saved the reserve's share of a distribution as a "donation" row with this donor name. */
const LEGACY_RESERVE_SHARE = "yearly profit distribution";

/** Epoch ms for ISO or Postgres timestamps ("2026-08-08 15:55:11.383953+05"). */
export function toEpoch(ts: string): number {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(ts.trim());
  if (m) {
    let tz = m[4] ?? "";
    if (/^[+-]\d{2}$/.test(tz)) tz += ":00";
    else if (/^[+-]\d{4}$/.test(tz)) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
    const t = Date.parse(`${m[1]}T${m[2]}${(m[3] ?? "").slice(0, 4)}${tz}`);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(ts);
}

export interface LedgerEntry {
  date: string;
  kind: EntryKind;
  voucher: string;
  particulars: string;
  /** Donor / payee / notes as entered, for reserve fund entries. */
  detail?: string;
  sourceId: string;
  memberId?: string;
  memberNo?: string;
  memberName?: string;
  loanNo?: string;
  loanId?: string;
  meetingId?: string | null;
  /** When the row was recorded (contributions), used to rebuild a distribution's basis. */
  createdAt?: string;
  amount: number;
  /** Posted to Loans to members: the total payable on a disbursement, a penalty charged, or a whole repayment. */
  loans: number;
  /** Flat interest charged, on disbursements only. */
  interest: number;
  /** Late penalty charged, on penalty charges only. */
  penalty: number;
  cashIn: number;
  cashOut: number;
}

export interface Balances {
  asAt: string | null;
  cash: number;
  /** Balance still owed on loans: total payable + penalties charged, less repayments. */
  loansReceivable: number;
  allowance: number;
  netLoans: number;
  totalAssets: number;
  savings: number;
  reserve: number;
  surplus: number;
  totalFunds: number;
  /** Assets − funds; always ~0 because every posting is balanced. */
  difference: number;
}

export interface Movements {
  contributions: number;
  disbursements: number;
  repayments: number;
  /** Flat interest charged on loans issued in the period (income). */
  interestIncome: number;
  /** Late penalties charged in the period (income). */
  penaltyIncome: number;
  /** Interest on loans repaid in full in the period. */
  interestReceived: number;
  /** Penalties on loans repaid in full in the period. */
  penaltiesReceived: number;
  donations: number;
  expenses: number;
  bankProfit: number;
  profitToMembers: number;
  profitToReserve: number;
  impairment: number;
  cashIn: number;
  cashOut: number;
}

export interface ControlCheck {
  label: string;
  expected: number;
  actual: number;
  difference: number;
  ok: boolean;
  note?: string;
}

export interface MeetingRecord {
  dbId: string;
  date: string;
  agenda: string;
  decisions: string;
  present: number;
  absent: number;
  recorded: boolean;
  collections: number;
  contributionCount: number;
}

export interface AttendanceSummaryRow {
  member: MemberRecord;
  eligible: number;
  present: number;
  absent: number;
  rate: number | null;
}

export interface Books {
  members: MemberRecord[];
  memberById: Map<string, MemberRecord>;
  loans: LoanRecord[];
  loanById: Map<string, LoanRecord>;
  entries: LedgerEntry[];
  distributions: Array<ProfitDistribution & { voucher: string }>;
  meetings: MeetingRecord[];
  firstActivity: string | null;
  balancesAt(asAt: string | null): Balances;
  movements(period: ReportPeriod): Movements;
  allowanceAt(asAt: string | null): number;
  loanPositionAt(loan: LoanRecord, asAt: string): LoanPosition | null;
  memberSavingsAt(memberId: string, asAt: string | null): number;
  memberLoanOwedAt(memberId: string, asAt: string | null): number;
  controls(asAt: string): ControlCheck[];
  attendanceSummary(period: ReportPeriod): AttendanceSummaryRow[];
  distributionBasis(distributionId: string): DistributionBasis | null;
}

/** Each member's contributions that a distribution's shares were calculated from. */
export interface DistributionBasis {
  byMember: Map<string, number>;
  total: number;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

type RegisterKey = { join: string; name: string; id: string };

/** Register order behind member numbers (M-001…): date of admission, then name, then id. */
export const registerOrder = (a: RegisterKey, b: RegisterKey) =>
  a.join.localeCompare(b.join) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

export const memberNumber = (index: number) => `M-${pad(index + 1, 3)}`;

export function buildBooks(input: AccountingInput): Books {
  // ── Members, numbered by date of admission so register numbers stay stable as members are added.
  const members: MemberRecord[] = [...input.members]
    .map((m) => ({ m, join: dayKey(m.joinDate) }))
    .sort((a, b) => registerOrder({ join: a.join, name: a.m.name, id: a.m.dbId }, { join: b.join, name: b.m.name, id: b.m.dbId }))
    .map(({ m, join }, i) => ({
      memberNo: memberNumber(i),
      dbId: m.dbId,
      name: m.name,
      fatherName: m.fatherName || "",
      phone: m.phone || "",
      email: m.email || "",
      address: m.address || "",
      joinDate: join,
      masterBalance: r2(Number(m.totalBudget) || 0),
      source: m,
    }));
  const memberById = new Map(members.map((m) => [m.dbId, m]));

  // ── Loans
  const rawLoans = members.flatMap((mr) => mr.source.loans.map((loan) => ({ mr, loan })));
  rawLoans.sort((a, b) => dayKey(a.loan.date).localeCompare(dayKey(b.loan.date)) || a.loan.dbId.localeCompare(b.loan.dbId));

  const loans: LoanRecord[] = rawLoans.map(({ mr, loan }, i) => {
    const date = dayKey(loan.date);
    const principal = r2(Number(loan.amount) || 0);
    const totalPayable = r2(Math.max(Number(loan.totalPayable) || principal, principal));
    const interest = r2(totalPayable - principal);
    const termMonths = Math.max(1, Math.round(loan.termMonths || 1));
    const systemOutstanding = r2(Math.max(0, Number(loan.remainingAmount) || 0));
    const penalties: PenaltyRow[] = (loan.penalties || [])
      .map((p) => ({ month: p.month, date: dayKey(p.chargeDate), amount: r2(Number(p.amount) || 0) }))
      .sort((a, b) => a.month - b.month);
    const penaltyTotal = sum(penalties, (p) => p.amount);
    const penaltiesBy = (asAt: string) => sum(penalties.filter((p) => p.date <= asAt), (p) => p.amount);

    // Itemised receipts, plus any repayment the loan row reflects but no installment row explains
    // (loans recorded before per-payment tracking existed) — carried as a dated opening receipt.
    const itemised = [...(loan.installments || [])]
      .map((inst, k) => ({ date: dayKey(inst.date), amount: r2(Number(inst.amount) || 0), sourceId: inst.id || `${loan.dbId}-i${k}`, itemised: true }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.sourceId.localeCompare(b.sourceId));
    const itemisedTotal = sum(itemised, (x) => x.amount);
    const unitemised = r2(totalPayable + penaltyTotal - systemOutstanding - itemisedTotal);
    const rawReceipts = unitemised > EPS
      ? [{ date, amount: unitemised, sourceId: `${loan.dbId}-bf`, itemised: false }, ...itemised]
      : itemised;

    // Interest (at issue) and penalties (as charged) are already in the balance owed, so a receipt
    // just reduces it — it is never split between the amount lent, interest and penalties.
    let cumRepaid = 0;
    const receipts: LoanReceipt[] = rawReceipts.map((rc) => {
      cumRepaid = r2(cumRepaid + rc.amount);
      return { ...rc, balanceAfter: r2(totalPayable + penaltiesBy(rc.date) - cumRepaid), voucher: "" };
    });

    let schedule: ScheduleRow[] = (loan.schedule || []).map((s) => ({
      no: s.installmentNumber,
      dueDate: dayKey(s.dueDate),
      dueAmount: r2(Number(s.dueAmount) || 0),
    }));
    const scheduleIsDerived = schedule.length === 0;
    if (scheduleIsDerived) {
      // Same equal-installment plan useLoans.issueLoan writes for new loans.
      const base = Math.floor((totalPayable / termMonths) * 100) / 100;
      let allocated = 0;
      schedule = Array.from({ length: termMonths }, (_, k) => {
        const due = k === termMonths - 1 ? r2(totalPayable - allocated) : base;
        allocated = r2(allocated + due);
        return { no: k + 1, dueDate: format(addMonths(parseDay(date), k + 1), "yyyy-MM-dd"), dueAmount: due };
      });
    }

    return {
      loanNo: `LN-${pad(i + 1, 4)}`,
      dbId: loan.dbId,
      memberId: mr.dbId,
      memberNo: mr.memberNo,
      memberName: mr.name,
      date,
      principal,
      interestRate: Number(loan.interestRate) || (principal > 0 ? r2((interest / principal) * 100) : 0),
      interest,
      totalPayable,
      termMonths,
      state: normaliseLoanState(loan.status),
      systemOutstanding,
      receipts,
      schedule,
      scheduleIsDerived,
      maturityDate: loanDueDate(date),
      penaltyPerMonth: r2(Number(loan.penaltyPerMonth) || 0),
      penalties,
      penaltyTotal,
      paidInFullOn: paidInFullOn(r2(totalPayable + penaltyTotal), date, rawReceipts),
      disbursementVoucher: "",
    };
  });
  const loanById = new Map(loans.map((l) => [l.dbId, l]));

  // ── Ledger entries
  const entries: LedgerEntry[] = [];
  const base = { loans: 0, interest: 0, penalty: 0, cashIn: 0, cashOut: 0 };

  for (const mr of members) {
    for (const c of mr.source.monthlyContributions) {
      const amount = r2(Number(c.amount) || 0);
      entries.push({
        ...base,
        date: dayKey(c.month),
        kind: "contribution",
        voucher: "",
        particulars: "Monthly contribution",
        sourceId: c.id || `${mr.dbId}-${dayKey(c.month)}-${amount}`,
        memberId: mr.dbId,
        memberNo: mr.memberNo,
        memberName: mr.name,
        meetingId: c.meetingId ?? null,
        createdAt: c.createdAt,
        amount,
        cashIn: amount,
      });
    }
  }

  for (const loan of loans) {
    entries.push({
      ...base,
      date: loan.date,
      kind: "disbursement",
      voucher: "",
      particulars: `Loan ${loan.loanNo} disbursed`,
      sourceId: loan.dbId,
      memberId: loan.memberId,
      memberNo: loan.memberNo,
      memberName: loan.memberName,
      loanNo: loan.loanNo,
      loanId: loan.dbId,
      amount: loan.principal,
      loans: loan.totalPayable,
      interest: loan.interest,
      cashOut: loan.principal,
    });
    for (const pen of loan.penalties) {
      entries.push({
        ...base,
        date: pen.date,
        kind: "penalty_charge",
        voucher: "",
        particulars: `Late payment penalty - month ${pen.month} past due - ${loan.loanNo}`,
        sourceId: `${loan.dbId}-p${pen.month}`,
        memberId: loan.memberId,
        memberNo: loan.memberNo,
        memberName: loan.memberName,
        loanNo: loan.loanNo,
        loanId: loan.dbId,
        amount: pen.amount,
        loans: pen.amount,
        penalty: pen.amount,
      });
    }
    for (const rc of loan.receipts) {
      entries.push({
        ...base,
        date: rc.date,
        kind: "repayment",
        voucher: "",
        particulars: rc.itemised ? `Repayment - ${loan.loanNo}` : `Repayment b/f (not itemised) - ${loan.loanNo}`,
        sourceId: rc.sourceId,
        memberId: loan.memberId,
        memberNo: loan.memberNo,
        memberName: loan.memberName,
        loanNo: loan.loanNo,
        loanId: loan.dbId,
        amount: rc.amount,
        loans: rc.amount,
        cashIn: rc.amount,
      });
    }
  }

  for (const t of input.reserveTransactions) {
    const amount = r2(Number(t.amount) || 0);
    const date = dayKey(t.date);
    const detail = [t.donorName, t.notes].filter(Boolean).join(" - ");
    if (t.type === "expense") {
      entries.push({ ...base, date, kind: "expense", voucher: "", particulars: detail || KIND_LABELS.expense, detail, sourceId: t.id, amount, cashOut: amount });
    } else if (t.type === "profit_allocation" || (t.donorName || "").trim().toLowerCase() === LEGACY_RESERVE_SHARE) {
      entries.push({ ...base, date, kind: "profit_reserve", voucher: "", particulars: "Reserve share of bank profit", detail, sourceId: t.id, amount });
    } else {
      entries.push({ ...base, date, kind: "donation", voucher: "", particulars: detail || KIND_LABELS.donation, detail, sourceId: t.id, amount, cashIn: amount });
    }
  }

  const distributions = [...input.profitDistributions]
    .sort((a, b) => dayKey(a.date).localeCompare(dayKey(b.date)) || a.id.localeCompare(b.id))
    .map((d, i) => ({ ...d, voucher: `JV-${pad(i + 1, 4)}` }));

  for (const d of distributions) {
    const totalProfit = r2(Number(d.totalProfit) || 0);
    entries.push({
      ...base,
      date: dayKey(d.date),
      kind: "bank_profit",
      voucher: "",
      particulars: `Bank profit on funds held in the account - distributed under ${d.voucher}`,
      sourceId: `${d.id}-bank`,
      amount: totalProfit,
      cashIn: totalProfit,
    });
    for (const a of d.memberAllocations) {
      const mr = memberById.get(a.memberId);
      entries.push({
        ...base,
        date: dayKey(d.date),
        kind: "profit_member",
        voucher: d.voucher,
        particulars: `Share of bank profit - ${d.voucher}`,
        sourceId: `${d.id}-${a.memberId}`,
        memberId: a.memberId,
        memberNo: mr?.memberNo,
        memberName: mr?.name ?? a.memberName,
        amount: r2(Number(a.amount) || 0),
      });
    }
  }

  entries.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      (a.memberNo || "").localeCompare(b.memberNo || "") ||
      (a.loanNo || "").localeCompare(b.loanNo || "") ||
      a.sourceId.localeCompare(b.sourceId),
  );

  // ── Voucher numbering: receipt (RV), payment (PV) and journal (JV) series in date order.
  let rv = 0;
  let pv = 0;
  let jv = distributions.length;
  const jvByDate = new Map(distributions.map((d) => [dayKey(d.date), d.voucher]));
  for (const e of entries) {
    if (e.kind === "profit_member") continue;
    // A penalty charge moves no cash; like the interest charged at issue, it is referenced by its loan number.
    if (e.kind === "penalty_charge") e.voucher = e.loanNo ?? "";
    else if (e.kind === "profit_reserve") e.voucher = jvByDate.get(e.date) ?? `JV-${pad(++jv, 4)}`;
    else if (e.cashIn > 0 || e.kind === "contribution" || e.kind === "repayment" || e.kind === "donation") e.voucher = `RV-${pad(++rv, 5)}`;
    else e.voucher = `PV-${pad(++pv, 5)}`;
  }
  for (const loan of loans) {
    loan.disbursementVoucher = entries.find((e) => e.kind === "disbursement" && e.loanId === loan.dbId)?.voucher ?? "";
    for (const rc of loan.receipts) {
      rc.voucher = entries.find((e) => e.kind === "repayment" && e.sourceId === rc.sourceId)?.voucher ?? "";
    }
  }

  // ── Meetings, attendance and meeting-linked collections
  const attendanceByMeeting = new Map<string, { present: number; absent: number }>();
  for (const mr of members) {
    for (const a of mr.source.attendance) {
      if (!a.meetingId) continue;
      const agg = attendanceByMeeting.get(a.meetingId) ?? { present: 0, absent: 0 };
      if (a.present) agg.present++;
      else agg.absent++;
      attendanceByMeeting.set(a.meetingId, agg);
    }
  }
  const meetings: MeetingRecord[] = [...input.meetings]
    .filter((m) => m.dbId)
    .map((m) => {
      const att = attendanceByMeeting.get(m.dbId);
      const linked = entries.filter((e) => e.kind === "contribution" && e.meetingId === m.dbId);
      return {
        dbId: m.dbId,
        date: dayKey(m.date),
        agenda: m.agenda || "",
        decisions: m.decisions || "",
        present: att?.present ?? 0,
        absent: att?.absent ?? 0,
        recorded: !!att,
        collections: sum(linked, (e) => e.amount),
        contributionCount: linked.length,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Helpers over the ledger
  const upTo = (asAt: string | null) => (asAt === null ? [] : entries.filter((e) => e.date <= asAt));

  const loanPositionAt = (loan: LoanRecord, asAt: string): LoanPosition | null => {
    if (loan.date > asAt) return null;
    const received = loan.receipts.filter((r) => r.date <= asAt);
    const repaid = sum(received, (r) => r.amount);
    const penaltiesCharged = sum(loan.penalties.filter((p) => p.date <= asAt), (p) => p.amount);
    const outstanding = r2(Math.max(0, loan.totalPayable + penaltiesCharged - repaid));
    // Interest and penalties are received together, when the loan is repaid in full.
    const paidInFull = loan.paidInFullOn !== null && loan.paidInFullOn <= asAt;
    const interestReceived = paidInFull ? loan.interest : 0;
    const penaltyReceived = paidInFull ? penaltiesCharged : 0;

    // Instalments are a guide: nothing is overdue until the loan's one-year due date has passed.
    const pastDue = asAt > loan.maturityDate && outstanding > EPS;
    const daysPastDue = pastDue ? differenceInCalendarDays(parseDay(asAt), parseDay(loan.maturityDate)) : 0;
    let pool = repaid;
    const schedule: ScheduleStatusRow[] = loan.schedule.map((row) => {
      const paid = r2(Math.min(row.dueAmount, Math.max(0, pool)));
      pool = r2(pool - paid);
      const balance = r2(row.dueAmount - paid);
      const overdue = balance > EPS && pastDue;
      return {
        ...row,
        paid,
        balance,
        status: balance <= EPS ? "Paid" : overdue ? "Overdue" : paid > EPS ? "Part-paid" : "Due",
        daysOverdue: overdue ? daysPastDue : 0,
      };
    });
    const arrears = pastDue ? outstanding : 0;
    // Loans recorded before the one-year rule may have instalment plans that end earlier; the
    // due date is then the next date anything falls due.
    const nextRow = schedule.find((s) => s.balance > EPS && s.dueDate >= asAt);
    const next = nextRow
      ? { dueDate: nextRow.dueDate, balance: nextRow.balance }
      : !pastDue && outstanding > EPS ? { dueDate: loan.maturityDate, balance: outstanding } : null;
    const state: LoanState = outstanding <= EPS ? "paid" : loan.state === "defaulted" ? "defaulted" : "active";

    let bucket: AgingBucket | null = null;
    if (state === "defaulted") bucket = "defaulted";
    else if (state === "active") {
      bucket = daysPastDue <= 0 ? "current" : daysPastDue <= 30 ? "1-30" : daysPastDue <= 60 ? "31-60" : daysPastDue <= 90 ? "61-90" : "90+";
    }

    return {
      loan,
      asAt,
      repaid,
      outstanding,
      interestReceived,
      interestOutstanding: r2(loan.interest - interestReceived),
      penaltiesCharged,
      penaltyReceived,
      penaltyOutstanding: r2(penaltiesCharged - penaltyReceived),
      arrears,
      daysPastDue,
      nextDueDate: next?.dueDate ?? null,
      nextDueAmount: next?.balance ?? 0,
      state,
      bucket,
      schedule,
    };
  };

  const allowanceAt = (asAt: string | null) => {
    if (asAt === null) return 0;
    return sum(
      loans.filter((l) => l.state === "defaulted"),
      (l) => loanPositionAt(l, asAt)?.outstanding ?? 0,
    );
  };

  const balancesAt = (asAt: string | null): Balances => {
    const es = upTo(asAt);
    const of = (k: EntryKind, pick: (e: LedgerEntry) => number = (e) => e.amount) => sum(es.filter((e) => e.kind === k), pick);
    const cash = r2(sum(es, (e) => e.cashIn) - sum(es, (e) => e.cashOut));
    const loansReceivable = r2(of("disbursement", (e) => e.loans) + of("penalty_charge", (e) => e.loans) - of("repayment", (e) => e.loans));
    const allowance = allowanceAt(asAt);
    const netLoans = r2(loansReceivable - allowance);
    const savings = r2(of("contribution") + of("profit_member"));
    const reserve = r2(of("donation") + of("profit_reserve") - of("expense"));
    const surplus = r2(of("disbursement", (e) => e.interest) + of("penalty_charge", (e) => e.penalty) + of("bank_profit") - of("profit_member") - of("profit_reserve") - allowance);
    const totalAssets = r2(cash + netLoans);
    const totalFunds = r2(savings + reserve + surplus);
    return { asAt, cash, loansReceivable, allowance, netLoans, totalAssets, savings, reserve, surplus, totalFunds, difference: r2(totalAssets - totalFunds) };
  };

  const movements = (period: ReportPeriod): Movements => {
    const es = entries.filter((e) => inPeriod(e.date, period));
    const of = (k: EntryKind, pick: (e: LedgerEntry) => number = (e) => e.amount) => sum(es.filter((e) => e.kind === k), pick);
    const paidInPeriod = loans.filter((l) => l.paidInFullOn !== null && inPeriod(l.paidInFullOn, period));
    return {
      contributions: of("contribution"),
      disbursements: of("disbursement"),
      repayments: of("repayment"),
      interestIncome: of("disbursement", (e) => e.interest),
      penaltyIncome: of("penalty_charge", (e) => e.penalty),
      interestReceived: sum(paidInPeriod, (l) => l.interest),
      penaltiesReceived: sum(paidInPeriod, (l) => l.penaltyTotal),
      donations: of("donation"),
      expenses: of("expense"),
      bankProfit: of("bank_profit"),
      profitToMembers: of("profit_member"),
      profitToReserve: of("profit_reserve"),
      impairment: r2(allowanceAt(period.to) - allowanceAt(openingDate(period))),
      cashIn: sum(es, (e) => e.cashIn),
      cashOut: sum(es, (e) => e.cashOut),
    };
  };

  const memberSavingsAt = (memberId: string, asAt: string | null) =>
    sum(upTo(asAt).filter((e) => e.memberId === memberId && (e.kind === "contribution" || e.kind === "profit_member")), (e) => e.amount);

  const memberLoanOwedAt = (memberId: string, asAt: string | null) =>
    asAt === null ? 0 : sum(loans.filter((l) => l.memberId === memberId), (l) => loanPositionAt(l, asAt)?.outstanding ?? 0);

  const controls = (asAt: string): ControlCheck[] => {
    const check = (label: string, expected: number, actual: number, note?: string, tolerance = 0.005): ControlCheck => {
      const difference = r2(actual - expected);
      return { label, expected: r2(expected), actual: r2(actual), difference, ok: Math.abs(difference) <= tolerance + 1e-9, note };
    };
    const current = asAt >= todayKey();
    const out: ControlCheck[] = [];
    const bs = balancesAt(asAt);
    out.push(check("Total assets agree with total funds", bs.totalFunds, bs.totalAssets));
    if (current) {
      out.push(
        check(
          "Members' savings: ledger vs. member master balances",
          bs.savings,
          sum(members, (m) => m.masterBalance),
          "Master balance is members.total_budget; a difference means a balance was edited outside the contribution/profit workflows.",
        ),
      );
      const ledgerOwed = (l: LoanRecord) => r2(l.totalPayable + l.penaltyTotal - sum(l.receipts, (r) => r.amount));
      const mismatched = loans.filter((l) => Math.abs(ledgerOwed(l) - l.systemOutstanding) >= 0.01);
      out.push(
        check(
          "Loan balances: repayment ledger vs. stored remaining amount",
          sum(loans, (l) => l.systemOutstanding),
          sum(loans, ledgerOwed),
          mismatched.length ? `Differences on ${mismatched.map((l) => l.loanNo).join(", ")}.` : undefined,
        ),
      );
    }
    const distUpTo = distributions.filter((d) => dayKey(d.date) <= asAt);
    if (distUpTo.length) {
      out.push(
        check(
          "Reserve share of bank profit: distributions vs. reserve ledger",
          sum(distUpTo, (d) => d.reserveAllocation),
          sum(entries.filter((e) => e.kind === "profit_reserve" && e.date <= asAt), (e) => e.amount),
          "A shortfall indicates a distribution whose reserve posting was not recorded.",
        ),
      );
      out.push(
        check(
          "Members' share of bank profit: declared vs. credited",
          sum(distUpTo, (d) => d.totalProfit - d.reserveAllocation),
          sum(distUpTo, (d) => sum(d.memberAllocations, (a) => a.amount)),
          "Small differences arise from rounding each member's share to the nearest paisa.",
          // each share may round by up to half a paisa
          0.005 * Math.max(1, sum(distUpTo, (d) => d.memberAllocations.length)),
        ),
      );
    }
    return out;
  };

  const attendanceSummary = (period: ReportPeriod): AttendanceSummaryRow[] => {
    const held = meetings.filter((m) => m.recorded && inPeriod(m.date, period));
    return members.map((mr) => {
      const eligibleMeetings = held.filter((m) => m.date >= mr.joinDate);
      const ids = new Set(eligibleMeetings.map((m) => m.dbId));
      const present = mr.source.attendance.filter((a) => a.present && a.meetingId && ids.has(a.meetingId)).length;
      const eligible = eligibleMeetings.length;
      return { member: mr, eligible, present, absent: eligible - present, rate: eligible ? present / eligible : null };
    });
  };

  // The app shares a distribution by each member's contributions on record at the moment it
  // was made. Rebuild that from record timestamps (falling back to contribution dates), and
  // only return it if it reproduces the stored ratios, so the statement never shows a basis
  // that differs from what was actually used.
  const distributionBasis = (distributionId: string): DistributionBasis | null => {
    const d = distributions.find((x) => x.id === distributionId);
    if (!d || !d.memberAllocations.length) return null;
    const cutoff = d.createdAt ? toEpoch(d.createdAt) : NaN;
    const counted = (e: LedgerEntry) =>
      e.createdAt && !Number.isNaN(cutoff) ? toEpoch(e.createdAt) <= cutoff : e.date <= dayKey(d.date);
    const byMember = new Map<string, number>();
    for (const e of entries) {
      if (e.kind !== "contribution" || !e.memberId || !counted(e)) continue;
      byMember.set(e.memberId, r2((byMember.get(e.memberId) ?? 0) + e.amount));
    }
    const total = r2([...byMember.values()].reduce((s, v) => s + v, 0));
    if (total <= 0) return null;
    const allocated = new Set(d.memberAllocations.map((a) => a.memberId));
    const matches =
      d.memberAllocations.every((a) => Math.abs((byMember.get(a.memberId) ?? 0) / total - Number(a.ratio)) < 0.0001) &&
      [...byMember.keys()].every((id) => allocated.has(id));
    return matches ? { byMember, total } : null;
  };

  const dates = entries.map((e) => e.date);
  return {
    members,
    memberById,
    loans,
    loanById,
    entries,
    distributions,
    meetings,
    firstActivity: dates.length ? dates[0] : null,
    balancesAt,
    movements,
    allowanceAt,
    loanPositionAt,
    memberSavingsAt,
    memberLoanOwedAt,
    controls,
    attendanceSummary,
    distributionBasis,
  };
}

export const entriesInPeriod = (books: Books, period: ReportPeriod) => books.entries.filter((e) => inPeriod(e.date, period));

export { inPeriod };
