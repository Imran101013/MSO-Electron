import type { AuditLogEntry } from "@/hooks/useAuditLog";
import type { UndoFormat } from "@/lib/auditUndo";

/**
 * Audit Log entries in words: what each one is (a title and a sentence for the table) and its
 * values (for the View dialog). An entry holds a raw database row, so the member, meeting and loan
 * it points to come from the joins in hooks/useAuditLog.ts.
 */

type Row = Record<string, unknown>;
type Format = Pick<UndoFormat, "day" | "money">;

export interface EntryField {
  label: string;
  /** Before the change (updates and removals). */
  before?: string;
  /** After the change (updates and additions). */
  after?: string;
}

export interface EntryDescription {
  /** Short: "Contribution received". */
  title: string;
  /** One sentence naming the member, amount and date, so the entry can be told apart from others. */
  detail: string;
  /** What was added, removed or changed (an update lists only the values that changed). */
  fields: EntryField[];
}

/** Where a change happened, in words (the filter on the Audit Log page uses the same names). */
export const AUDIT_AREAS: Record<string, string> = {
  monthly_contributions: "Contributions",
  attendance: "Attendance",
  loans: "Loans",
  loan_installments: "Loan repayments",
  loan_penalties: "Late penalties",
  loan_schedule: "Instalment plans (old)",
  reserve_transactions: "Reserve fund",
  bank_profits: "Bank profit",
  profit_distributions: "Profit distributions",
  profit_allocations: "Dividends",
};

export const ACTION_LABEL: Record<AuditLogEntry["action"], string> = { insert: "Added", update: "Changed", delete: "Removed" };

const num = (v: unknown) => Number(v) || 0;
const text = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const dayKey = (v: unknown) => text(v).slice(0, 10);
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

const attendanceOf = (r: Row) => (r.present ? "Present" : r.on_leave ? "On leave" : "Absent");
const LOAN_STATUS: Record<string, string> = { active: "Active", paid: "Repaid in full", defaulted: "Defaulted" };
const RESERVE_TYPE: Record<string, string> = {
  donation: "Donation",
  expense: "Expense",
  profit_allocation: "Share of the year's profit",
  opening: "Balance brought forward from the paper registers",
};
const isBankCharge = (r: Row) => r.transaction_type === "expense" && r.donor_name === "Bank" && text(r.notes).startsWith("Bank charge on the cheque withdrawal");

type Kind = "money" | "day" | "text" | "member" | "meeting" | "loan" | "attendance" | "loanStatus" | "reserveType" | "percent" | "months" | "number" | "yes" | "penaltyMonth" | "year";
/** [column, label, kind]. "attendance", "loan" and "year" are worked out from the row and the joins. */
type Spec = [string, string, Kind];

const FIELDS: Record<string, Spec[]> = {
  monthly_contributions: [
    ["member_id", "Member", "member"], ["amount", "Amount", "money"], ["meeting_id", "Meeting", "meeting"],
    ["contribution_date", "Date", "day"], ["notes", "Notes", "text"], ["is_opening", "Brought forward from the paper registers", "yes"],
  ],
  attendance: [["member_id", "Member", "member"], ["meeting_id", "Meeting", "meeting"], ["status", "Attendance", "attendance"]],
  loans: [
    ["member_id", "Member", "member"], ["amount", "Amount lent", "money"], ["loan_date", "Loan date", "day"],
    ["interest_rate", "Interest rate", "percent"], ["term_months", "Duration", "months"], ["total_payable", "Total payable", "money"],
    ["bank_charge", "Bank charge", "money"], ["remaining_amount", "Balance owed", "money"], ["status", "Status", "loanStatus"],
    ["defaulted_on", "Marked defaulted on", "day"], ["penalty_per_month", "Late penalty per month", "money"],
    ["opening_as_at", "Brought forward from the paper registers as at", "day"],
  ],
  loan_installments: [["loan_id", "Loan", "loan"], ["amount", "Amount repaid", "money"], ["payment_date", "Paid on", "day"]],
  loan_penalties: [["loan_id", "Loan", "loan"], ["penalty_month", "For", "penaltyMonth"], ["charge_date", "Charged on", "day"], ["amount", "Amount", "money"]],
  loan_schedule: [
    ["loan_id", "Loan", "loan"], ["installment_number", "Instalment", "number"], ["due_date", "Due on", "day"],
    ["due_amount", "Amount due", "money"], ["paid_amount", "Paid", "money"], ["status", "Status", "text"],
  ],
  reserve_transactions: [
    ["transaction_type", "Type", "reserveType"], ["amount", "Amount", "money"], ["transaction_date", "Date", "day"],
    ["donor_name", "Source / spent at", "text"], ["notes", "Notes", "text"],
  ],
  bank_profits: [
    ["amount", "Amount", "money"], ["profit_year", "Profit for the year", "number"], ["credited_on", "Credited by the bank on", "day"],
    ["meeting_id", "Recorded at", "meeting"], ["is_opening", "Brought forward from the paper registers", "yes"],
  ],
  profit_distributions: [
    ["profit_year", "Profit year", "number"], ["distribution_date", "Shared on", "day"], ["total_profit", "Total profit", "money"],
    ["bank_profit", "Bank profit", "money"], ["loan_interest", "Loan interest", "money"], ["loan_penalties", "Late penalties", "money"],
    ["absence_penalties", "Absence charges", "money"], ["absence_fine", "Absence charge per meeting", "money"],
    ["reserve_allocation", "To the reserve fund", "money"],
  ],
  profit_allocations: [
    ["member_id", "Member", "member"], ["distribution_id", "Profit year", "year"], ["savings_basis", "Savings on 31 December", "money"],
    ["gross_amount", "Share before absence charges", "money"], ["absences", "Absences", "number"],
    ["absence_penalty", "Absence charges", "money"], ["amount", "Dividend credited", "money"],
  ],
};

export function describeEntry(e: AuditLogEntry, f: Format): EntryDescription {
  const before: Row = e.old_data ?? {};
  const after: Row = e.new_data ?? {};
  const r: Row = e.action === "delete" ? before : after;
  const money = (v: unknown) => f.money(num(v));
  const day = (v: unknown) => (dayKey(v) ? f.day(dayKey(v)) : "—");

  const memberShort = e.member_name ?? "a member no longer in the records";
  const memberFull = e.member_name ? `${e.member_name}${e.member_father ? ` (father's name ${e.member_father})` : ""}` : "A member no longer in the records";
  const meeting = (row: Row) =>
    !row.meeting_id ? "Not at a meeting" : e.meeting_date ? `Meeting on ${day(e.meeting_date)}` : "A meeting since deleted";
  const atMeeting = (row: Row) =>
    !row.meeting_id ? "" : e.meeting_date ? ` at the meeting on ${day(e.meeting_date)}` : " at a meeting since deleted";
  const loanName = e.loan_amount != null ? `${memberShort}'s loan of ${money(e.loan_amount)}${e.loan_date ? ` from ${day(e.loan_date)}` : ""}` : `a loan of ${memberShort} no longer in the records`;

  const value = (row: Row, [key, , kind]: Spec): string => {
    const v = row[key];
    switch (kind) {
      case "money": return v === null || v === undefined ? "" : money(v);
      case "day": return dayKey(v) ? day(v) : "";
      case "member": return v ? memberFull : "";
      case "meeting": return meeting(row);
      case "loan": return v ? loanName.charAt(0).toUpperCase() + loanName.slice(1) : "";
      case "attendance": return row.member_id ? attendanceOf(row) : "";
      case "loanStatus": return LOAN_STATUS[text(v)] ?? text(v);
      case "reserveType": return RESERVE_TYPE[text(v)] ?? text(v);
      case "percent": return v === null || v === undefined ? "" : `${num(v)}%`;
      case "months": return v ? `${num(v)} month${num(v) === 1 ? "" : "s"}` : "";
      case "number": return v === null || v === undefined ? "" : String(v);
      case "yes": return v ? "Yes" : "";
      case "penaltyMonth": return num(v) === 0 ? "Penalties brought forward from the paper registers" : `The ${ordinal(num(v))} month late`;
      case "year": return e.distribution_year ? String(e.distribution_year) : "";
      default: return text(v);
    }
  };

  const specs = FIELDS[e.table_name] ?? [];
  const fields: EntryField[] =
    e.action === "update"
      ? specs.flatMap((s) => {
          const [b, a] = [value(before, s), value(after, s)];
          return b === a ? [] : [{ label: s[1], before: b || "—", after: a || "—" }];
        })
      : specs.flatMap((s) => {
          const v = value(r, s);
          return v ? [e.action === "delete" ? { label: s[1], before: v } : { label: s[1], after: v }] : [];
        });

  const removed = e.action === "delete";
  const say = (title: string, detail: string): EntryDescription => ({ title, detail, fields });

  switch (e.table_name) {
    case "monthly_contributions": {
      if (r.is_opening) return say(removed ? "Opening savings removed" : "Opening savings", `${money(r.amount)} of ${memberShort}'s savings brought forward from the paper registers`);
      const what = `${money(r.amount)} from ${memberShort}${atMeeting(r) || ` on ${day(r.contribution_date)}`}`;
      if (e.action === "update") return say("Contribution changed", `${memberShort}${atMeeting(r)}: ${money(before.amount)} → ${money(after.amount)}`);
      return say(removed ? "Contribution removed" : "Contribution received", what);
    }
    case "attendance": {
      if (e.action === "update") return say("Attendance changed", `${memberShort}${atMeeting(r)}: ${attendanceOf(before)} → ${attendanceOf(after)}`);
      return say(removed ? "Attendance removed" : "Attendance marked", `${memberShort}: ${attendanceOf(r)}${atMeeting(r)}`);
    }
    case "loans": {
      const loan = `${memberShort}'s loan of ${money(r.amount)} from ${day(r.loan_date)}`;
      if (e.action === "insert") {
        return r.opening_as_at
          ? say("Opening loan", `${money(r.amount)} lent to ${memberShort} on ${day(r.loan_date)}, brought forward from the paper registers with ${money(r.remaining_amount)} still owed`)
          : say("Loan issued", `${money(r.amount)} to ${memberShort} on ${day(r.loan_date)}, ${num(r.interest_rate)}% over ${num(r.term_months)} month${num(r.term_months) === 1 ? "" : "s"}`);
      }
      if (removed) return say(r.opening_as_at ? "Opening loan removed" : "Loan removed", loan);
      if (before.status !== after.status && after.status === "paid") return say("Loan repaid in full", `${loan}: nothing left to pay`);
      if (before.status !== after.status && after.status === "defaulted") return say("Loan marked defaulted", `${loan}, from ${day(after.defaulted_on)}`);
      if (before.status !== after.status) return say("Loan status changed", `${loan}: ${LOAN_STATUS[text(before.status)] ?? before.status} → ${LOAN_STATUS[text(after.status)] ?? after.status}`);
      if (num(before.bank_charge) !== num(after.bank_charge)) return say("Bank charge on a loan", `${loan}: bank charge ${money(before.bank_charge)} → ${money(after.bank_charge)}`);
      if (num(before.remaining_amount) !== num(after.remaining_amount)) {
        const down = num(after.remaining_amount) < num(before.remaining_amount);
        return say("Loan balance changed", `${loan}: balance ${money(before.remaining_amount)} → ${money(after.remaining_amount)} (${down ? "after a repayment" : "a penalty or charge added"})`);
      }
      return say("Loan details changed", loan);
    }
    case "loan_installments":
      if (e.action === "update") return say("Loan repayment changed", `${loanName}: ${money(before.amount)} → ${money(after.amount)}`);
      return say(removed ? "Loan repayment removed" : "Loan repayment", `${money(r.amount)} from ${memberShort} on ${day(r.payment_date)}, toward ${e.loan_amount != null ? `the loan of ${money(e.loan_amount)}${e.loan_date ? ` from ${day(e.loan_date)}` : ""}` : "a loan no longer in the records"}`);
    case "loan_penalties": {
      const month = num(r.penalty_month) === 0 ? "brought forward from the paper registers" : `for the ${ordinal(num(r.penalty_month))} month late`;
      return say(removed ? "Late penalty removed" : e.action === "update" ? "Late penalty changed" : "Late penalty charged", `${money(r.amount)} on ${loanName}, ${month}`);
    }
    case "loan_schedule":
      return say(`Instalment plan line ${ACTION_LABEL[e.action].toLowerCase()}`, `Instalment ${text(r.installment_number)} of ${loanName}: ${money(r.due_amount)} due ${day(r.due_date)}`);
    case "reserve_transactions": {
      const type = text(r.transaction_type);
      const label = isBankCharge(r) ? "Bank charge (reserve fund)" : type === "donation" ? "Reserve donation" : type === "expense" ? "Reserve expense" : type === "profit_allocation" ? "Reserve share of profit" : type === "opening" ? "Opening reserve balance" : "Reserve entry";
      // The Reserve page calls the name "Source" for a donation and "Spent at" for an expense.
      const who = text(r.donor_name) ? (type === "donation" ? `from ${text(r.donor_name)}` : type === "expense" ? `spent at ${text(r.donor_name)}` : text(r.donor_name)) : "";
      const extra = isBankCharge(r) ? text(r.notes) : type === "opening" ? "brought forward from the paper registers" : [who, text(r.notes)].filter(Boolean).join(" – ");
      return say(removed ? `${label} removed` : e.action === "update" ? `${label} changed` : label, `${money(r.amount)} on ${day(r.transaction_date)}${extra ? `: ${extra}` : ""}`);
    }
    case "bank_profits":
      if (r.is_opening) return say(removed ? "Opening bank profit removed" : "Opening bank profit", `${money(r.amount)} for ${text(r.profit_year)}, brought forward from the paper registers`);
      return say(removed ? "Bank profit removed" : "Bank profit recorded", `${money(r.amount)} for ${text(r.profit_year)}, credited by the bank on ${day(r.credited_on)}${atMeeting(r) ? `, recorded${atMeeting(r)}` : ""}`);
    case "profit_distributions":
      if (r.profit_year == null) return say(removed ? "Profit distribution removed" : "Profit distributed (old method)", `${money(r.total_profit)} on ${day(r.distribution_date)}`);
      return say(removed ? "Profit distribution undone" : "Profit distributed", `The ${text(r.profit_year)} profit of ${money(r.total_profit)}, shared on ${day(r.distribution_date)}; ${money(r.reserve_allocation)} to the reserve fund`);
    case "profit_allocations": {
      const year = e.distribution_year ? `the ${e.distribution_year} profit` : "a profit distribution";
      const charge = num(r.absence_penalty) > 0 ? ` after ${money(r.absence_penalty)} in absence charges` : "";
      return say(removed ? "Dividend removed" : "Dividend credited", `${money(r.amount)} to ${memberShort} from ${year}${charge}`);
    }
    case "all_records":
      return { title: "All records cleared", detail: text(after.note) || "Every record was cleared from Settings", fields: [] };
    default:
      return say(`${AUDIT_AREAS[e.table_name] ?? e.table_name}: ${ACTION_LABEL[e.action].toLowerCase()}`, "");
  }
}
