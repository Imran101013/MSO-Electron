import { dbQuery } from "@/lib/db";
import { cutoverBlock } from "@/lib/books";
import { owedWithPayment, syncLoanPenalties } from "@/hooks/useLoans";
import { removeBankProfit } from "@/hooks/useBankProfits";
import { ATTENDANCE_LABEL, attendanceLockedYear, attendanceStatus, saveMeetingAttendance } from "@/hooks/useAttendance";
import type { AuditLogEntry } from "@/hooks/useAuditLog";

/**
 * Undo for the Audit Log.
 *
 * An audit entry is one row changing in one table, but a change made in the app usually touches more
 * than that row: a contribution also raises the member's savings (members.total_budget, which isn't
 * audited), a repayment lowers the loan's balance and can cancel late penalties, a distribution
 * credits every member and the reserve fund. So an entry is never simply put back as it was. Each
 * kind of change has its own undo that reverses the whole of what the app did, with the same checks
 * the app makes when the change is entered. Entries that are only a consequence of another change
 * (late penalties, a loan's balance moving, one member's dividend) can't be undone themselves; the
 * reason says which change to undo instead.
 *
 * Once a year's profit has been distributed, records dated up to 31 December of that year are
 * settled (the distribution was worked out from them), so they can't be undone until the
 * distribution itself is. An undo is itself recorded in the Audit Log, so it can be undone too.
 */

type Row = Record<string, unknown>;

export type UndoKind =
  | "contribution-remove" | "contribution-restore"
  | "payment-remove" | "payment-restore"
  | "loan-remove" | "loan-restore"
  | "default-undo" | "default-redo" | "bank-charge-undo"
  | "reserve-remove" | "reserve-restore"
  | "bank-profit-remove" | "bank-profit-restore"
  | "attendance-revert"
  | "distribution-undo";

export type UndoCheck = { kind: UndoKind; reason?: undefined } | { kind: null; reason: string };

const OPENING = "Opening balances from the paper registers are changed by importing the corrected file again (Settings).";
const NOT_HERE = "This change can't be undone here.";
const IS_BANK_CHARGE = (t: Row) =>
  t.transaction_type === "expense" && t.donor_name === "Bank" && String(t.notes ?? "").startsWith("Bank charge on the cheque withdrawal for ");

/** Whether an entry can be undone, without looking at the database (for the button). */
export function undoKind(e: AuditLogEntry): UndoCheck {
  const row: Row = (e.action === "delete" ? e.old_data : e.new_data) ?? {};
  const no = (reason: string): UndoCheck => ({ kind: null, reason });
  switch (e.table_name) {
    case "monthly_contributions":
      if (row.is_opening) return no(OPENING);
      if (e.action === "insert") return { kind: "contribution-remove" };
      if (e.action === "delete") return { kind: "contribution-restore" };
      return no(NOT_HERE);
    case "loan_installments":
      if (e.action === "insert") return { kind: "payment-remove" };
      if (e.action === "delete") return { kind: "payment-restore" };
      return no(NOT_HERE);
    case "loans": {
      if (e.action !== "update" && row.opening_as_at) return no(OPENING);
      if (e.action === "insert") return { kind: "loan-remove" };
      if (e.action === "delete") return { kind: "loan-restore" };
      const before: Row = e.old_data ?? {};
      if (before.status === "active" && row.status === "defaulted") return { kind: "default-undo" };
      // Undoing a default clears its date; a repayment on a defaulted loan keeps it.
      if (before.status === "defaulted" && row.status === "active" && before.defaulted_on && !row.defaulted_on) return { kind: "default-redo" };
      if (Number(before.bank_charge ?? 0) !== Number(row.bank_charge ?? 0)) return { kind: "bank-charge-undo" };
      return no("The balance changed because of a repayment or a late penalty. Undo the repayment instead; late penalties follow by themselves.");
    }
    case "loan_penalties":
      return no("Late penalties are worked out by the app from the due date and the repayments. They change by themselves when a repayment is undone.");
    case "loan_schedule":
      return no("Instalment plans are no longer used.");
    case "reserve_transactions":
      if (row.transaction_type === "opening") return no(OPENING);
      if (row.transaction_type === "profit_allocation") return no("This is the reserve fund's share of a profit distribution. Undo the distribution itself.");
      if (e.action === "insert") return { kind: "reserve-remove" };
      if (e.action === "delete") return { kind: "reserve-restore" };
      return no(NOT_HERE);
    case "bank_profits":
      if (row.is_opening) return no(OPENING);
      if (e.action === "insert") return { kind: "bank-profit-remove" };
      if (e.action === "delete") return { kind: "bank-profit-restore" };
      return no(NOT_HERE);
    case "attendance":
      if (e.action === "update") return { kind: "attendance-revert" };
      if (e.action === "insert") return no("Marked when the meeting was saved. To change it, open the meeting on the Meetings page and use Edit.");
      return no("Removed together with its meeting.");
    case "profit_distributions":
      if (e.action !== "insert") return no("To distribute a year's profit again, use the Profit Distribution page.");
      if (row.profit_year == null) return no("Distributions made with the old method (bank profit only) can't be undone.");
      return { kind: "distribution-undo" };
    case "profit_allocations":
      return no("This is one member's dividend from a profit distribution. Undo the distribution itself.");
    case "all_records":
      return no("Clearing all records can't be undone here. Restore a backup instead (Settings).");
    default:
      return no(NOT_HERE);
  }
}

export interface UndoFormat {
  /** yyyy-MM-dd as the app shows dates. */
  day: (key: string) => string;
  money: (n: number) => string;
  dateFormat: string;
}

export interface PreparedUndo {
  title: string;
  /** What the undo will change, in words, for the confirmation. */
  body: string;
  /** Makes the change; resolves to the message to show, or throws with the reason nothing changed. */
  run: () => Promise<string>;
}

const CHANGED = "The records changed while Undo was open, so nothing was undone. Try again.";
const key = (d: unknown) => String(d ?? "").slice(0, 10);
const num = (n: unknown) => Number(n) || 0;

// A record dated `col` (SQL) isn't in a year whose profit has been distributed.
const notSettled = (col: string) =>
  `NOT EXISTS (SELECT 1 FROM public.profit_distributions d WHERE d.profit_year IS NOT NULL AND ${col} <= make_date(d.profit_year, 12, 31))`;

async function settledProblem(date: unknown, f: UndoFormat): Promise<string | null> {
  const [r] = await dbQuery<{ y: number | null }>("SELECT MAX(profit_year)::int AS y FROM public.profit_distributions");
  const y = r?.y == null ? null : Number(r.y);
  if (y === null || key(date) > `${y}-12-31`) return null;
  return `The ${y} profit has been distributed, so records dated up to ${f.day(`${y}-12-31`)} are settled. Undo the ${y} distribution first to change this.`;
}

async function memberName(id: unknown): Promise<string> {
  const [m] = await dbQuery<{ name: string; father_name: string | null }>("SELECT name, father_name FROM public.members WHERE id = $1", [id]);
  if (!m) return "a member no longer in the records";
  return m.father_name ? `${m.name} (father's name ${m.father_name})` : m.name;
}

async function reserveBalance(): Promise<number> {
  const [r] = await dbQuery<{ balance: number }>(
    "SELECT COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN -amount ELSE amount END), 0) AS balance FROM public.reserve_transactions",
  );
  return num(r?.balance);
}

type Prepared = PreparedUndo | { reason: string };

/**
 * Checks an entry against the records as they are now and says what undoing it will do. Nothing
 * changes until `run` is called; `run` repeats the checks in the statement that makes the change.
 */
export async function prepareUndo(e: AuditLogEntry, f: UndoFormat): Promise<Prepared> {
  const check = undoKind(e);
  if (!check.kind) return { reason: check.reason };
  const before: Row = e.old_data ?? {};
  const after: Row = e.new_data ?? {};
  switch (check.kind) {
    case "contribution-remove": return contributionRemove(after, f);
    case "contribution-restore": return contributionRestore(before, f);
    case "payment-remove": return paymentRemove(after, f);
    case "payment-restore": return paymentRestore(before, f);
    case "loan-remove": return loanRemove(after, f);
    case "loan-restore": return loanRestore(before, f);
    case "default-undo": return defaultUndo(e.record_id, before, after, f);
    case "default-redo": return defaultRedo(e.record_id, before, f);
    case "bank-charge-undo": return bankChargeUndo(e.record_id, before, after, f);
    case "reserve-remove": return reserveRemove(after, f);
    case "reserve-restore": return reserveRestore(before, f);
    case "bank-profit-remove": return bankProfitRemove(after, f);
    case "bank-profit-restore": return bankProfitRestore(before, f);
    case "attendance-revert": return attendanceRevert(e.record_id, before, after, f);
    case "distribution-undo": return distributionUndo(after, f);
  }
  return { reason: NOT_HERE };
}

// ── Contributions: a contribution is also in the member's savings.

async function contributionRemove(c: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.monthly_contributions WHERE id = $1", [c.id]);
  if (!cur) return { reason: "This contribution is no longer in the records: it was already undone, or removed with its member." };
  const settled = await settledProblem(c.contribution_date, f);
  if (settled) return { reason: settled };
  const name = await memberName(c.member_id);
  return {
    title: "Undo this contribution?",
    body: `Removes the contribution of ${f.money(num(c.amount))} from ${name} dated ${f.day(key(c.contribution_date))}, and takes it off the member's savings.`,
    run: async () => {
      const rows = await dbQuery(
        `WITH c AS (
           DELETE FROM public.monthly_contributions WHERE id = $1 AND NOT is_opening AND ${notSettled("contribution_date")}
           RETURNING member_id, amount
         )
         UPDATE public.members m SET total_budget = COALESCE(m.total_budget, 0) - c.amount FROM c WHERE m.id = c.member_id RETURNING m.id`,
        [c.id],
      );
      if (!rows.length) throw new Error(CHANGED);
      return `The contribution of ${f.money(num(c.amount))} from ${name} was removed.`;
    },
  };
}

async function contributionRestore(c: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.monthly_contributions WHERE id = $1", [c.id]);
  if (cur) return { reason: "This contribution is already back in the records." };
  const [member] = await dbQuery("SELECT id FROM public.members WHERE id = $1", [c.member_id]);
  if (!member) return { reason: "The member is no longer in the records, so the contribution can't be put back." };
  const blocked = (await settledProblem(c.contribution_date, f)) ?? (await cutoverBlock(key(c.contribution_date), f.dateFormat));
  if (blocked) return { reason: blocked };
  const name = await memberName(c.member_id);
  return {
    title: "Put this contribution back?",
    body: `Puts back the contribution of ${f.money(num(c.amount))} from ${name} dated ${f.day(key(c.contribution_date))}, and adds it to the member's savings.`,
    run: async () => {
      const rows = await dbQuery(
        `WITH c AS (
           INSERT INTO public.monthly_contributions (id, member_id, meeting_id, amount, contribution_date, notes, is_opening, created_at)
           SELECT $1::uuid, $2::uuid, (SELECT id FROM public.meetings WHERE id = $3::uuid), $4::numeric, $5::date, $6::text, false, COALESCE($7::timestamptz, now())
           WHERE NOT EXISTS (SELECT 1 FROM public.monthly_contributions WHERE id = $1::uuid)
             AND EXISTS (SELECT 1 FROM public.members WHERE id = $2::uuid) AND ${notSettled("$5::date")}
           RETURNING member_id, amount
         )
         UPDATE public.members m SET total_budget = COALESCE(m.total_budget, 0) + c.amount FROM c WHERE m.id = c.member_id RETURNING m.id`,
        [c.id, c.member_id, c.meeting_id ?? null, c.amount, key(c.contribution_date), c.notes ?? null, c.created_at ?? null],
      );
      if (!rows.length) throw new Error(CHANGED);
      return `The contribution of ${f.money(num(c.amount))} from ${name} was put back.`;
    },
  };
}

// ── Loan repayments: a repayment is also off the loan's balance, and can cancel late penalties.

interface LoanInfo { id: string; member_id: string; amount: number; loan_date: string; status: string; bank_charge: number; remaining_amount: number; defaulted_on: string | null }

async function loanInfo(id: unknown): Promise<LoanInfo | undefined> {
  const [l] = await dbQuery<LoanInfo>(
    "SELECT id, member_id, amount, loan_date::text AS loan_date, status, bank_charge, remaining_amount, defaulted_on::text AS defaulted_on FROM public.loans WHERE id = $1",
    [id],
  );
  return l;
}

const loanLabel = async (l: { member_id: unknown; amount: unknown; loan_date: unknown }, f: UndoFormat) =>
  `the loan of ${f.money(num(l.amount))} issued on ${f.day(key(l.loan_date))} to ${await memberName(l.member_id)}`;

async function paymentRemove(p: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.loan_installments WHERE id = $1", [p.id]);
  const loan = await loanInfo(p.loan_id);
  if (!cur || !loan) return { reason: "This repayment is no longer in the records: it was already undone, or removed with its loan." };
  const settled = await settledProblem(p.payment_date, f);
  if (settled) return { reason: settled };
  const label = await loanLabel(loan, f);
  return {
    title: "Undo this repayment?",
    body: `Removes the repayment of ${f.money(num(p.amount))} made on ${f.day(key(p.payment_date))} on ${label}. The amount goes back on the balance owed${loan.status === "paid" ? ", so the loan is no longer repaid in full," : ""} and late penalties are worked out again.`,
    run: async () => {
      const rows = await dbQuery(
        `WITH p AS (
           DELETE FROM public.loan_installments WHERE id = $1 AND ${notSettled("payment_date")} RETURNING loan_id, amount
         )
         UPDATE public.loans l SET remaining_amount = l.remaining_amount + p.amount,
           status = CASE WHEN l.status = 'paid' THEN (CASE WHEN l.defaulted_on IS NOT NULL THEN 'defaulted' ELSE 'active' END) ELSE l.status END
         FROM p WHERE l.id = p.loan_id RETURNING l.id`,
        [p.id],
      );
      if (!rows.length) throw new Error(CHANGED);
      await syncLoanPenalties(loan.id);
      return `The repayment of ${f.money(num(p.amount))} was removed from ${label}.`;
    },
  };
}

async function paymentRestore(p: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.loan_installments WHERE id = $1", [p.id]);
  if (cur) return { reason: "This repayment is already back in the records." };
  const loan = await loanInfo(p.loan_id);
  if (!loan) return { reason: "The loan is no longer in the records, so the repayment can't be put back." };
  const blocked = (await settledProblem(p.payment_date, f)) ?? (await cutoverBlock(key(p.payment_date), f.dateFormat));
  if (blocked) return { reason: blocked };
  const owed = await owedWithPayment(loan.id, { date: key(p.payment_date), amount: num(p.amount) });
  if (owed === null || num(p.amount) > owed + 0.005) {
    return { reason: `This repayment is more than the loan now owes (${f.money(owed ?? 0)}), so it can't be put back.` };
  }
  const label = await loanLabel(loan, f);
  return {
    title: "Put this repayment back?",
    body: `Puts back the repayment of ${f.money(num(p.amount))} made on ${f.day(key(p.payment_date))} on ${label}. It comes off the balance owed, and late penalties are worked out again.`,
    run: async () => {
      const rows = await dbQuery(
        `WITH p AS (
           INSERT INTO public.loan_installments (id, loan_id, amount, payment_date, created_at)
           SELECT $1::uuid, $2::uuid, $3::numeric, $4::date, COALESCE($5::timestamptz, now())
           WHERE NOT EXISTS (SELECT 1 FROM public.loan_installments WHERE id = $1::uuid)
             AND EXISTS (SELECT 1 FROM public.loans WHERE id = $2::uuid) AND ${notSettled("$4::date")}
           RETURNING loan_id, amount
         )
         UPDATE public.loans l SET remaining_amount = l.remaining_amount - p.amount,
           status = CASE WHEN l.remaining_amount - p.amount <= 0.005 THEN 'paid' ELSE l.status END
         FROM p WHERE l.id = p.loan_id RETURNING l.id`,
        [p.id, p.loan_id, p.amount, key(p.payment_date), p.created_at ?? null],
      );
      if (!rows.length) throw new Error(CHANGED);
      await syncLoanPenalties(loan.id);
      return `The repayment of ${f.money(num(p.amount))} was put back on ${label}.`;
    },
  };
}

// ── Loans

async function loanRemove(l: Row, f: UndoFormat): Promise<Prepared> {
  const loan = await loanInfo(l.id);
  if (!loan) return { reason: "This loan is no longer in the records: it was already undone, or removed with its member." };
  const [{ n }] = await dbQuery<{ n: number }>("SELECT COUNT(*)::int AS n FROM public.loan_installments WHERE loan_id = $1", [l.id]);
  if (Number(n) > 0) return { reason: `${n} repayment${Number(n) === 1 ? " has" : "s have"} been recorded on this loan. Undo ${Number(n) === 1 ? "it" : "them"} first.` };
  const settled = await settledProblem(loan.loan_date, f);
  if (settled) return { reason: settled };
  const name = await memberName(loan.member_id);
  const charge = num(loan.bank_charge);
  return {
    title: "Undo this loan?",
    body: `Removes the loan of ${f.money(num(loan.amount))} to ${name} issued on ${f.day(loan.loan_date)}${charge > 0 ? `, with its bank charge of ${f.money(charge)}` : ""}, and any late penalties on it.`,
    run: async () => {
      const rows = await dbQuery(
        `DELETE FROM public.loans l WHERE l.id = $1 AND l.opening_as_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.loan_installments i WHERE i.loan_id = l.id) AND ${notSettled("l.loan_date")}
         RETURNING l.id`,
        [l.id],
      );
      if (!rows.length) throw new Error(CHANGED);
      return `The loan of ${f.money(num(loan.amount))} to ${name} was removed.`;
    },
  };
}

async function loanRestore(l: Row, f: UndoFormat): Promise<Prepared> {
  if (await loanInfo(l.id)) return { reason: "This loan is already back in the records." };
  const [member] = await dbQuery("SELECT id FROM public.members WHERE id = $1", [l.member_id]);
  if (!member) return { reason: "The member is no longer in the records, so the loan can't be put back." };
  const blocked = (await settledProblem(l.loan_date, f)) ?? (await cutoverBlock(key(l.loan_date), f.dateFormat));
  if (blocked) return { reason: blocked };
  const name = await memberName(l.member_id);
  const defaulted = l.status === "defaulted" && l.defaulted_on;
  return {
    title: "Put this loan back?",
    body: `Puts back the loan of ${f.money(num(l.amount))} to ${name} issued on ${f.day(key(l.loan_date))}${defaulted ? `, marked defaulted on ${f.day(key(l.defaulted_on))}` : ""}. Nothing is repaid on it yet; late penalties are worked out again.`,
    run: async () => {
      const rows = await dbQuery<{ id: string }>(
        `INSERT INTO public.loans (id, member_id, amount, remaining_amount, loan_date, status, term_months, interest_rate, total_payable,
           penalty_per_month, bank_charge, defaulted_on, created_at)
         SELECT $1::uuid, $2::uuid, $3::numeric, $8::numeric + $10::numeric, $4::date, $5::text, $6::int, $7::numeric, $8::numeric,
           $9::numeric, $10::numeric, $11::date, COALESCE($12::timestamptz, now())
         WHERE NOT EXISTS (SELECT 1 FROM public.loans WHERE id = $1::uuid)
           AND EXISTS (SELECT 1 FROM public.members WHERE id = $2::uuid) AND ${notSettled("$4::date")}
         RETURNING id`,
        [l.id, l.member_id, l.amount, key(l.loan_date), defaulted ? "defaulted" : "active", l.term_months ?? 12, l.interest_rate ?? 0,
          l.total_payable, l.penalty_per_month ?? 0, l.bank_charge ?? 0, defaulted ? key(l.defaulted_on) : null, l.created_at ?? null],
      );
      if (!rows.length) throw new Error(CHANGED);
      await syncLoanPenalties(String(l.id));
      return `The loan of ${f.money(num(l.amount))} to ${name} was put back.`;
    },
  };
}

async function defaultUndo(id: string | null, before: Row, after: Row, f: UndoFormat): Promise<Prepared> {
  const loan = await loanInfo(id);
  if (!loan) return { reason: "This loan is no longer in the records." };
  if (loan.status !== "defaulted" || key(loan.defaulted_on) !== key(after.defaulted_on)) {
    return { reason: "This loan is no longer marked defaulted on that date, so there is nothing to undo." };
  }
  const settled = await settledProblem(after.defaulted_on, f);
  if (settled) return { reason: settled };
  const label = await loanLabel(loan, f);
  return {
    title: "Undo marking this loan defaulted?",
    body: `Makes ${label} active again, as it was before it was marked defaulted on ${f.day(key(after.defaulted_on))}. A late penalty is added again for each full month it has been late since.`,
    run: async () => {
      const rows = await dbQuery(
        `UPDATE public.loans SET status = 'active', defaulted_on = $3::date
         WHERE id = $1 AND status = 'defaulted' AND defaulted_on = $2::date AND ${notSettled("$2::date")} RETURNING id`,
        [loan.id, key(after.defaulted_on), before.defaulted_on ? key(before.defaulted_on) : null],
      );
      if (!rows.length) throw new Error(CHANGED);
      await syncLoanPenalties(loan.id);
      return `${label[0].toUpperCase()}${label.slice(1)} is active again.`;
    },
  };
}

async function defaultRedo(id: string | null, before: Row, f: UndoFormat): Promise<Prepared> {
  const loan = await loanInfo(id);
  if (!loan) return { reason: "This loan is no longer in the records." };
  if (loan.status !== "active") return { reason: `This loan is ${loan.status === "paid" ? "repaid" : "marked defaulted"} now, so it can't be marked defaulted again.` };
  const date = key(before.defaulted_on);
  const blocked = (await settledProblem(date, f)) ?? (await cutoverBlock(date, f.dateFormat));
  if (blocked) return { reason: blocked };
  const label = await loanLabel(loan, f);
  return {
    title: "Mark this loan defaulted again?",
    body: `Marks ${label} defaulted again on ${f.day(date)}. Late penalties charged after that day are taken off.`,
    run: async () => {
      const rows = await dbQuery(
        `UPDATE public.loans SET status = 'defaulted', defaulted_on = $2::date
         WHERE id = $1 AND status = 'active' AND loan_date <= $2::date AND ${notSettled("$2::date")} RETURNING id`,
        [loan.id, date],
      );
      if (!rows.length) throw new Error(CHANGED);
      await syncLoanPenalties(loan.id);
      return `${label[0].toUpperCase()}${label.slice(1)} is marked defaulted again.`;
    },
  };
}

async function bankChargeUndo(id: string | null, before: Row, after: Row, f: UndoFormat): Promise<Prepared> {
  const loan = await loanInfo(id);
  if (!loan) return { reason: "This loan is no longer in the records." };
  const from = num(after.bank_charge);
  const to = num(before.bank_charge);
  if (Math.abs(num(loan.bank_charge) - from) > 0.005) return { reason: "The bank charge on this loan has been changed again since. Undo the later change first." };
  if (loan.status !== "active") return { reason: `A bank charge can only be changed on an active loan, and this loan is ${loan.status === "paid" ? "repaid" : "marked defaulted"}.` };
  if (num(loan.remaining_amount) + (to - from) < 0) return { reason: "The balance owed is now less than this would take off it, so the bank charge can't be put back." };
  const settled = await settledProblem(loan.loan_date, f);
  if (settled) return { reason: settled };
  const label = await loanLabel(loan, f);
  return {
    title: "Undo this bank charge change?",
    body: `Puts the bank charge on ${label} back to ${f.money(to)} (it was changed to ${f.money(from)}). The balance owed changes by ${f.money(Math.abs(to - from))}.`,
    run: async () => {
      const [res] = await dbQuery<{ n: number }>(
        `WITH l AS (
           SELECT id, bank_charge FROM public.loans WHERE id = $1 AND status = 'active' AND bank_charge = $3::numeric AND ${notSettled("loan_date")} FOR UPDATE
         ),
         u AS (
           UPDATE public.loans SET bank_charge = $2::numeric, remaining_amount = loans.remaining_amount + ($2::numeric - l.bank_charge)
           FROM l WHERE loans.id = l.id AND loans.remaining_amount + ($2::numeric - l.bank_charge) >= 0
           RETURNING loans.id
         )
         SELECT (SELECT COUNT(*) FROM u)::int AS n`,
        [loan.id, to, from],
      );
      if (!res || Number(res.n) === 0) throw new Error(CHANGED);
      await syncLoanPenalties(loan.id);
      return `The bank charge on ${label} is ${f.money(to)} again.`;
    },
  };
}

// ── Reserve fund: an expense above the limit has its bank charge as a second row, entered with it.

// A bank charge row's notes already say what it was for.
const reserveWhat = (t: Row) => (IS_BANK_CHARGE(t) ? String(t.notes ?? "") : [t.donor_name, t.notes].filter(Boolean).join(" - "));

async function reserveRemove(t: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.reserve_transactions WHERE id = $1", [t.id]);
  if (!cur) return { reason: "This entry is no longer in the reserve fund: it was already undone." };
  const settled = await settledProblem(t.transaction_date, f);
  if (settled) return { reason: settled };
  const amount = num(t.amount);
  const isCharge = IS_BANK_CHARGE(t);
  const [charge] = t.transaction_type === "expense" && !isCharge
    ? await dbQuery<{ id: string; amount: number }>(
        `SELECT id, amount FROM public.reserve_transactions
         WHERE created_at = $1::timestamptz AND transaction_date = $2::date AND transaction_type = 'expense' AND donor_name = 'Bank'
           AND notes LIKE 'Bank charge on the cheque withdrawal for %' AND id <> $3`,
        [t.created_at, key(t.transaction_date), t.id],
      )
    : [];
  const balance = await reserveBalance();
  if (t.transaction_type === "donation" && balance - amount < -0.005) {
    return { reason: `The reserve fund has ${f.money(balance)} now, so taking out this donation of ${f.money(amount)} would leave it below zero.` };
  }
  const kind = t.transaction_type === "donation" ? "donation" : isCharge ? "bank charge" : "expense";
  const what = reserveWhat(t);
  const ids = [t.id, ...(charge ? [charge.id] : [])];
  const total = amount + num(charge?.amount);
  return {
    title: `Undo this reserve fund ${kind}?`,
    body:
      t.transaction_type === "donation"
        ? `Removes the donation of ${f.money(amount)}${what ? ` (${what})` : ""} dated ${f.day(key(t.transaction_date))} from the reserve fund, which goes down by ${f.money(amount)}.`
        : `Removes the ${kind} of ${f.money(amount)}${what ? ` (${what})` : ""} dated ${f.day(key(t.transaction_date))}${charge ? `, with its bank charge of ${f.money(num(charge.amount))},` : ""} from the reserve fund, which goes up by ${f.money(total)}.`,
    run: async () => {
      const rows = await dbQuery<{ id: string }>(
        `DELETE FROM public.reserve_transactions WHERE id = ANY($1::uuid[]) AND transaction_type IN ('donation', 'expense') AND ${notSettled("transaction_date")} RETURNING id`,
        [ids],
      );
      if (!rows.some((r) => r.id === t.id)) throw new Error(CHANGED);
      return `The reserve fund ${kind} of ${f.money(amount)} was removed.`;
    },
  };
}

async function reserveRestore(t: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.reserve_transactions WHERE id = $1", [t.id]);
  if (cur) return { reason: "This entry is already back in the reserve fund." };
  const blocked = (await settledProblem(t.transaction_date, f)) ?? (await cutoverBlock(key(t.transaction_date), f.dateFormat));
  if (blocked) return { reason: blocked };
  const amount = num(t.amount);
  const balance = await reserveBalance();
  if (t.transaction_type === "expense" && amount > balance + 0.005) {
    return { reason: `The reserve fund has ${f.money(balance)} now, less than this expense of ${f.money(amount)}.` };
  }
  const kind = t.transaction_type === "donation" ? "donation" : IS_BANK_CHARGE(t) ? "bank charge" : "expense";
  const what = reserveWhat(t);
  return {
    title: `Put this reserve fund ${kind} back?`,
    body: `Puts back the ${kind} of ${f.money(amount)}${what ? ` (${what})` : ""} dated ${f.day(key(t.transaction_date))} in the reserve fund.`,
    run: async () => {
      const rows = await dbQuery(
        `INSERT INTO public.reserve_transactions (id, transaction_type, amount, transaction_date, donor_name, notes, created_at)
         SELECT $1::uuid, $2::text, $3::numeric, $4::date, $5::text, $6::text, COALESCE($7::timestamptz, now())
         WHERE NOT EXISTS (SELECT 1 FROM public.reserve_transactions WHERE id = $1::uuid) AND ${notSettled("$4::date")}
         RETURNING id`,
        [t.id, t.transaction_type, t.amount, key(t.transaction_date), t.donor_name ?? null, t.notes ?? null, t.created_at ?? null],
      );
      if (!rows.length) throw new Error(CHANGED);
      return `The reserve fund ${kind} of ${f.money(amount)} was put back.`;
    },
  };
}

// ── Bank profit: shared at the AGM for its year, so it can't change once that year is distributed.

async function yearDistributed(year: unknown): Promise<boolean> {
  const [r] = await dbQuery<{ n: number }>("SELECT COUNT(*)::int AS n FROM public.profit_distributions WHERE profit_year = $1", [Number(year)]);
  return Number(r?.n) > 0;
}

async function bankProfitRemove(b: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.bank_profits WHERE id = $1", [b.id]);
  if (!cur) return { reason: "This bank profit is no longer in the records: it was already undone." };
  if (await yearDistributed(b.profit_year)) {
    return { reason: `The ${b.profit_year} profit has been distributed, so its bank profit can't be taken out. Undo the ${b.profit_year} distribution first.` };
  }
  return {
    title: "Undo this bank profit?",
    body: `Removes the bank profit of ${f.money(num(b.amount))} credited on ${f.day(key(b.credited_on))} for ${b.profit_year}.`,
    run: async () => {
      if (!(await removeBankProfit(String(b.id)))) throw new Error(CHANGED);
      return `The bank profit of ${f.money(num(b.amount))} for ${b.profit_year} was removed.`;
    },
  };
}

async function bankProfitRestore(b: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery("SELECT id FROM public.bank_profits WHERE id = $1", [b.id]);
  if (cur) return { reason: "This bank profit is already back in the records." };
  if (await yearDistributed(b.profit_year)) {
    return { reason: `The ${b.profit_year} profit has been distributed, so no more bank profit can be added to it. Undo the ${b.profit_year} distribution first.` };
  }
  const blocked = await cutoverBlock(key(b.credited_on), f.dateFormat);
  if (blocked) return { reason: blocked };
  return {
    title: "Put this bank profit back?",
    body: `Puts back the bank profit of ${f.money(num(b.amount))} credited on ${f.day(key(b.credited_on))} for ${b.profit_year}.`,
    run: async () => {
      const rows = await dbQuery(
        `INSERT INTO public.bank_profits (id, meeting_id, amount, credited_on, profit_year, is_opening, created_at)
         SELECT $1::uuid, (SELECT id FROM public.meetings WHERE id = $2::uuid), $3::numeric, $4::date, $5::int, false, COALESCE($6::timestamptz, now())
         WHERE NOT EXISTS (SELECT 1 FROM public.bank_profits WHERE id = $1::uuid)
           AND NOT EXISTS (SELECT 1 FROM public.profit_distributions WHERE profit_year = $5::int)
         RETURNING id`,
        [b.id, b.meeting_id ?? null, b.amount, key(b.credited_on), Number(b.profit_year), b.created_at ?? null],
      );
      if (!rows.length) throw new Error(CHANGED);
      return `The bank profit of ${f.money(num(b.amount))} for ${b.profit_year} was put back.`;
    },
  };
}

// ── Attendance: absences are charged at the AGM, so a mark can't change once its year is distributed.

async function attendanceRevert(id: string | null, before: Row, after: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery<{ present: boolean; on_leave: boolean; member_id: string; meeting_id: string; meeting_date: string }>(
    `SELECT a.present, a.on_leave, a.member_id, a.meeting_id, mt.meeting_date::text AS meeting_date
     FROM public.attendance a JOIN public.meetings mt ON mt.id = a.meeting_id WHERE a.id = $1`,
    [id],
  );
  if (!cur) return { reason: "This attendance mark is no longer in the records: its meeting was deleted." };
  const now = attendanceStatus(cur);
  const back = attendanceStatus({ present: !!before.present, on_leave: !!before.on_leave });
  const changedTo = attendanceStatus({ present: !!after.present, on_leave: !!after.on_leave });
  if (now === back) return { reason: `This mark is already back to ${ATTENDANCE_LABEL[back]}.` };
  if (now !== changedTo) return { reason: "This mark has been changed again since. Undo the later change first." };
  const locked = await attendanceLockedYear(cur.meeting_id);
  if (locked !== null) {
    return { reason: `The ${locked} profit has been distributed with the absences counted, so attendance at ${locked} meetings can't change. Undo the ${locked} distribution first.` };
  }
  const name = await memberName(cur.member_id);
  return {
    title: "Undo this attendance change?",
    body: `Changes the attendance of ${name} at the meeting on ${f.day(cur.meeting_date)} back from ${ATTENDANCE_LABEL[now]} to ${ATTENDANCE_LABEL[back]}.`,
    run: async () => {
      const res = await saveMeetingAttendance(cur.meeting_id, [{ memberId: cur.member_id, status: back }]);
      if (!res.saved || res.changed !== 1) throw new Error(CHANGED);
      return `${name} is marked ${ATTENDANCE_LABEL[back]} at the meeting on ${f.day(cur.meeting_date)} again.`;
    },
  };
}

// ── Profit distribution: dividends credited to every member's savings and a share to the reserve fund.

async function distributionUndo(d: Row, f: UndoFormat): Promise<Prepared> {
  const [cur] = await dbQuery<{ profit_year: number; distribution_date: string; reserve_allocation: number; members: number; dividends: number; latest: number }>(
    `SELECT d.profit_year, d.distribution_date::text AS distribution_date, d.reserve_allocation,
       (SELECT COUNT(*) FROM public.profit_allocations a WHERE a.distribution_id = d.id)::int AS members,
       (SELECT COALESCE(SUM(a.amount), 0) FROM public.profit_allocations a WHERE a.distribution_id = d.id) AS dividends,
       (SELECT MAX(x.profit_year) FROM public.profit_distributions x)::int AS latest
     FROM public.profit_distributions d WHERE d.id = $1`,
    [d.id],
  );
  if (!cur) return { reason: "This distribution is no longer in the records: it was already undone." };
  const year = Number(cur.profit_year);
  if (Number(cur.latest) > year) {
    return { reason: `The ${cur.latest} profit was distributed after this one, using members' savings that include these dividends. Undo the ${cur.latest} distribution first.` };
  }
  const reserve = num(cur.reserve_allocation);
  const balance = await reserveBalance();
  if (balance - reserve < -0.005) {
    return { reason: `The reserve fund has ${f.money(balance)} now, less than its ${f.money(reserve)} share of this distribution, so it can't be taken back.` };
  }
  return {
    title: `Undo the ${year} profit distribution?`,
    body: `Takes back the ${year} profit shared on ${f.day(cur.distribution_date)}: ${f.money(num(cur.dividends))} of dividends off ${cur.members} members' savings, and ${f.money(reserve)} out of the reserve fund. The ${year} profit can then be distributed again, and its records, attendance and bank profit can be changed.`,
    run: async () => {
      const [res] = await dbQuery<{ removed: number }>(
        `WITH d AS (
           SELECT id, distribution_date, created_at FROM public.profit_distributions p
           WHERE p.id = $1 AND p.profit_year IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.profit_distributions x WHERE x.profit_year > p.profit_year)
         ),
         a AS (SELECT member_id, amount FROM public.profit_allocations WHERE distribution_id IN (SELECT id FROM d)),
         m AS (
           UPDATE public.members SET total_budget = COALESCE(members.total_budget, 0) - a.amount FROM a WHERE members.id = a.member_id RETURNING members.id
         ),
         r AS (
           DELETE FROM public.reserve_transactions t USING d
           WHERE t.transaction_type = 'profit_allocation' AND t.transaction_date = d.distribution_date AND t.created_at = d.created_at
           RETURNING t.id
         ),
         x AS (DELETE FROM public.profit_distributions WHERE id IN (SELECT id FROM d) RETURNING id)
         SELECT (SELECT COUNT(*) FROM x)::int AS removed, (SELECT COUNT(*) FROM m)::int AS members, (SELECT COUNT(*) FROM r)::int AS reserve`,
        [d.id],
      );
      if (!res || Number(res.removed) !== 1) throw new Error(CHANGED);
      return `The ${year} profit distribution was undone. The ${year} profit can be distributed again on the Profit Distribution page.`;
    },
  };
}
