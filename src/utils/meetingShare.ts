import { format } from "date-fns";
import { dbQuery } from "@/lib/db";
import { formatTime as formatClockTime } from "@/lib/utils";
import { parseLocalDate } from "@/hooks/useLoans";
import type { DbMeeting } from "@/hooks/useMeetings";
import type { Settings } from "@/contexts/SettingsContext";
import { figureBlock, footer, heading, letterhead } from "@/utils/whatsappFormat";

export type AmountRow = { memberId: string; name: string; amount: number };
export type ReserveEntry = { transaction_type: string; amount: number; donor_name: string | null; notes: string | null };
type FormatSettings = Pick<Settings, "dateFormat" | "currency" | "timeFormat">;
type ShareSettings = FormatSettings & Pick<Settings, "organizationName">;

/** Everything recorded for one meeting — shown in the Meeting Details dialog and shared on WhatsApp. */
export interface MeetingRecord {
  meeting: DbMeeting;
  venue: string | null;
  attendance: { memberId: string; name: string; present: boolean; onLeave: boolean }[];
  presentCount: number;
  absent: string[];
  /** Not at the meeting but excused (their contribution was sent); not counted as absent. */
  onLeave: string[];
  /** Every member who had joined by the meeting, with 0 for those who paid nothing. */
  savings: AmountRow[];
  /** Loan repayments since the previous meeting, up to and including this one. */
  collected: AmountRow[];
  /** Loans issued since the previous meeting, up to and including this one. */
  newLoans: AmountRow[];
  reserve: ReserveEntry[];
  /** The bank's profit recorded with this meeting (hooks/useBankProfits.ts). */
  bankProfits: { amount: number; credited_on: string; profit_year: number }[];
  next: { meeting_date: string; meeting_time: string | null; venue: string | null } | null;
  totals: { savings: number; collected: number; newLoans: number; totalCollected: number };
}

const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

export const formatAmount = (v: number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

export const formatDay = (key: string, settings: Pick<Settings, "dateFormat">) =>
  format(parseLocalDate(key.slice(0, 10)), settings.dateFormat || "dd/MM/yyyy");

export const formatTime = (t: string | null, settings: Pick<Settings, "timeFormat">) => formatClockTime(t, settings.timeFormat);

export const reserveLabel = (t: ReserveEntry) => {
  const detail = [t.donor_name, t.notes].filter(Boolean).join(" - ");
  const label = t.transaction_type === "expense" ? "Expense" : t.transaction_type === "profit_allocation" ? "Share of the year's profit" : t.transaction_type === "opening" ? "Balance brought forward from the paper registers" : "Donation";
  return `${label}${detail && t.transaction_type !== "profit_allocation" && t.transaction_type !== "opening" ? ` (${detail})` : ""}`;
};

export async function getMeetingRecord(meeting: DbMeeting): Promise<MeetingRecord> {
  const day = meeting.meeting_date.slice(0, 10);
  const byMember = "ORDER BY m.join_date, m.name";

  // Loans and reserve entries aren't linked to a meeting, so a meeting covers everything
  // dated after the previous meeting, up to and including its own date.
  const prevRows = await dbQuery<{ prev: string | null }>(
    "SELECT MAX(meeting_date)::text AS prev FROM public.meetings WHERE meeting_date < $1::date",
    [day],
  );
  const prev = prevRows[0]?.prev ?? null;
  const since = (col: string) => `${col} <= $1::date AND ($2::date IS NULL OR ${col} > $2::date)`;

  const [attendance, savings, collected, newLoans, reserve, venueRows, nextRows, bankProfits] = await Promise.all([
    dbQuery<{ memberId: string; name: string; present: boolean; onLeave: boolean }>(
      `SELECT m.id AS "memberId", m.name, a.present, a.on_leave AS "onLeave" FROM public.attendance a JOIN public.members m ON m.id = a.member_id WHERE a.meeting_id = $1 ${byMember}`,
      [meeting.id],
    ),
    dbQuery<AmountRow>(
      `SELECT m.id AS "memberId", m.name, COALESCE(SUM(c.amount), 0) AS amount FROM public.members m
       LEFT JOIN public.monthly_contributions c ON c.member_id = m.id AND c.meeting_id = $1 AND c.amount > 0
       WHERE m.join_date <= $2::date OR c.id IS NOT NULL
       GROUP BY m.id, m.name, m.join_date ${byMember}`,
      [meeting.id, day],
    ),
    dbQuery<AmountRow>(
      `SELECT m.id AS "memberId", m.name, SUM(i.amount) AS amount FROM public.loan_installments i
       JOIN public.loans l ON l.id = i.loan_id JOIN public.members m ON m.id = l.member_id
       WHERE ${since("i.payment_date")} GROUP BY m.id, m.name, m.join_date ${byMember}`,
      [day, prev],
    ),
    dbQuery<AmountRow>(
      `SELECT m.id AS "memberId", m.name, l.amount FROM public.loans l JOIN public.members m ON m.id = l.member_id
       WHERE ${since("l.loan_date")} ${byMember}, l.loan_date`,
      [day, prev],
    ),
    dbQuery<ReserveEntry>(
      `SELECT transaction_type, amount, donor_name, notes FROM public.reserve_transactions WHERE ${since("transaction_date")} ORDER BY transaction_date, created_at`,
      [day, prev],
    ),
    // A meeting recorded before its venue was kept: the venue it was scheduled with, if any.
    dbQuery<{ venue: string }>(
      `SELECT venue FROM public.upcoming_meetings WHERE meeting_date = $1::date AND COALESCE(venue, '') <> '' ORDER BY created_at DESC LIMIT 1`,
      [day],
    ),
    dbQuery<{ meeting_date: string; meeting_time: string | null; venue: string | null }>(
      `SELECT meeting_date, meeting_time, venue FROM public.upcoming_meetings
       WHERE meeting_date > $1::date AND meeting_date >= CURRENT_DATE ORDER BY meeting_date, meeting_time LIMIT 1`,
      [day],
    ),
    dbQuery<{ amount: number; credited_on: string; profit_year: number }>(
      "SELECT amount, credited_on::text AS credited_on, profit_year FROM public.bank_profits WHERE meeting_id = $1 ORDER BY credited_on, created_at",
      [meeting.id],
    ),
  ]);

  return {
    meeting,
    venue: meeting.venue?.trim() || venueRows[0]?.venue || null,
    attendance,
    presentCount: attendance.filter((a) => a.present).length,
    absent: attendance.filter((a) => !a.present && !a.onLeave).map((a) => a.name),
    onLeave: attendance.filter((a) => !a.present && a.onLeave).map((a) => a.name),
    savings,
    collected,
    newLoans,
    reserve,
    bankProfits,
    next: nextRows[0] ?? null,
    totals: {
      savings: sum(savings),
      collected: sum(collected),
      newLoans: sum(newLoans),
      totalCollected: sum(savings) + sum(collected),
    },
  };
}

/**
 * Formats a meeting record as a WhatsApp message for the group (layout in utils/whatsappFormat.ts):
 * the totals at a glance first, then the agenda, attendance and each member's figures.
 */
export function formatMeetingMessage(record: MeetingRecord, settings: ShareSettings): string {
  const { meeting, savings, collected, newLoans, reserve, attendance, presentCount, absent, onLeave, next, totals } = record;
  const cur = settings.currency || "PKR";
  const date = (key: string) => formatDay(key, settings);
  const longDate = (key: string) => `${format(parseLocalDate(key.slice(0, 10)), "EEEE")}, ${date(key)}`;
  const numbered = (names: string[]) => names.map((n, i) => `${i + 1}. ${n}`).join("\n");
  // Members' figures with a total; a member who paid nothing shows why, if their attendance says.
  const table = (rows: AmountRow[], nothing?: (memberId: string) => string) =>
    figureBlock([
      ...rows.map((r) => ({ label: r.name, amount: Number(r.amount) > 0 || !nothing ? Number(r.amount) : nothing(r.memberId) })),
      "rule",
      { label: "Total", amount: sum(rows) },
    ]);
  const paidNothing = (memberId: string) => {
    const a = attendance.find((x) => x.memberId === memberId);
    return a?.onLeave ? "on leave" : a && !a.present ? "absent" : "–";
  };

  const out: string[] = [...letterhead(settings, "Monthly Meeting Record"), `📅 ${longDate(meeting.meeting_date)}`];
  if (record.venue) out.push(`📍 ${record.venue}`);
  // The currency is named once here, not with every amount.
  out.push(`_Amounts in ${cur}_`);


  out.push("", heading("Agenda"), meeting.agenda?.trim() || "-");
  if (meeting.decisions?.trim()) out.push("", heading("Decisions"), meeting.decisions.trim());

  if (attendance.length) {
    out.push("", heading("Attendance"), `Present ${presentCount} · Absent ${absent.length} · On leave ${onLeave.length}`);
    // if (absent.length) out.push("Absent:", numbered(absent));
    // if (onLeave.length) out.push("On leave:", numbered(onLeave));
    // if (!absent.length && !onLeave.length) out.push("All members were present.");
  }

  out.push("", heading("Savings"), savings.length ? table(savings, paidNothing) : "No members recorded.");
  out.push("", heading("Loans collected"), collected.length ? table(collected) : "No loan repayments were received.");
  if (newLoans.length) out.push("", heading("New loans issued"), table(newLoans));

  if (reserve.length) {
    out.push("", heading("Reserve fund"));
    for (const t of reserve) out.push(`• ${reserveLabel(t)}: ${t.transaction_type === "expense" ? "-" : "+"}${formatAmount(t.amount)}`);
  }
  if (record.bankProfits.length) {
    out.push("", heading("Bank profit"));
    for (const b of record.bankProfits) out.push(`• Profit for ${b.profit_year}, credited ${date(b.credited_on)}: +${formatAmount(b.amount)}`);
  }

  out.push(
    "",
    heading("Summary"),
    figureBlock([
      ...(attendance.length ? [{ label: "Members present", amount: `${presentCount} of ${attendance.length}` }] : []),
      { label: "Savings", amount: totals.savings },
      { label: "Loans collected", amount: totals.collected },
      "rule",
      { label: "Total collected", amount: totals.totalCollected },
      ...(newLoans.length ? [{ label: "New loans issued", amount: totals.newLoans }] : []),
    ]),
  );

  if (next) {
    const time = formatTime(next.meeting_time, settings);
    out.push("", heading("Next meeting"), `📅 ${longDate(next.meeting_date)}${time ? ` · ${time}` : ""}`);
    if (next.venue) out.push(`📍 ${next.venue}`);
  }

  out.push(...footer("Prepared from the MSO meeting record."));
  return out.join("\n");
}

export async function buildMeetingShareMessage(meeting: DbMeeting, settings: ShareSettings): Promise<string> {
  return formatMeetingMessage(await getMeetingRecord(meeting), settings);
}
