import { format } from "date-fns";
import { dbQuery } from "@/lib/db";
import { formatTimeTo12Hour } from "@/lib/utils";
import { parseLocalDate } from "@/hooks/useLoans";
import type { DbMeeting } from "@/hooks/useMeetings";
import type { Settings } from "@/contexts/SettingsContext";

export type AmountRow = { memberId: string; name: string; amount: number };
export type ReserveEntry = { transaction_type: string; amount: number; donor_name: string | null; notes: string | null };
type FormatSettings = Pick<Settings, "dateFormat" | "currency" | "timeFormat">;
type ShareSettings = FormatSettings & Pick<Settings, "organizationName">;

/** Everything recorded for one meeting — shown in the Meeting Details dialog and shared on WhatsApp. */
export interface MeetingRecord {
  meeting: DbMeeting;
  venue: string | null;
  attendance: { memberId: string; name: string; present: boolean }[];
  absent: string[];
  /** Every member who had joined by the meeting, with 0 for those who paid nothing. */
  savings: AmountRow[];
  /** Loan repayments since the previous meeting, up to and including this one. */
  collected: AmountRow[];
  /** Loans issued since the previous meeting, up to and including this one. */
  newLoans: AmountRow[];
  reserve: ReserveEntry[];
  next: { meeting_date: string; meeting_time: string | null; venue: string | null } | null;
  totals: { savings: number; collected: number; newLoans: number; totalCollected: number };
}

const sum = (rows: { amount: number }[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

export const formatAmount = (v: number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

export const formatDay = (key: string, settings: Pick<Settings, "dateFormat">) =>
  format(parseLocalDate(key.slice(0, 10)), settings.dateFormat || "dd/MM/yyyy");

export const formatTime = (t: string | null, settings: Pick<Settings, "timeFormat">) =>
  !t ? "" : settings.timeFormat === "24" ? t.slice(0, 5) : formatTimeTo12Hour(t.slice(0, 5));

export const reserveLabel = (t: ReserveEntry) => {
  const detail = [t.donor_name, t.notes].filter(Boolean).join(" - ");
  const label = t.transaction_type === "expense" ? "Expense" : t.transaction_type === "profit_allocation" ? "Share of bank profit" : "Donation";
  return `${label}${detail && t.transaction_type !== "profit_allocation" ? ` (${detail})` : ""}`;
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

  const [attendance, savings, collected, newLoans, reserve, venueRows, nextRows] = await Promise.all([
    dbQuery<{ memberId: string; name: string; present: boolean }>(
      `SELECT m.id AS "memberId", m.name, a.present FROM public.attendance a JOIN public.members m ON m.id = a.member_id WHERE a.meeting_id = $1 ${byMember}`,
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
    // Meetings don't store a venue; use the one it was scheduled with, if any.
    dbQuery<{ venue: string }>(
      `SELECT venue FROM public.upcoming_meetings WHERE meeting_date = $1::date AND COALESCE(venue, '') <> '' ORDER BY created_at DESC LIMIT 1`,
      [day],
    ),
    dbQuery<{ meeting_date: string; meeting_time: string | null; venue: string | null }>(
      `SELECT meeting_date, meeting_time, venue FROM public.upcoming_meetings
       WHERE meeting_date > $1::date AND meeting_date >= CURRENT_DATE ORDER BY meeting_date, meeting_time LIMIT 1`,
      [day],
    ),
  ]);

  return {
    meeting,
    venue: venueRows[0]?.venue ?? null,
    attendance,
    absent: attendance.filter((a) => !a.present).map((a) => a.name),
    savings,
    collected,
    newLoans,
    reserve,
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
 * Formats a meeting record as a WhatsApp message. Uses WhatsApp formatting (*bold*,
 * ```monospace``` so names and amounts line up).
 */
export function formatMeetingMessage(record: MeetingRecord, settings: ShareSettings): string {
  const { meeting, savings, collected, newLoans, reserve, attendance, absent, next, totals } = record;
  const cur = settings.currency || "PKR";
  const money = (v: number) => `${cur} ${formatAmount(v)}`;
  const date = (key: string) => formatDay(key, settings);
  const orgName =
    settings.organizationName?.trim() && settings.organizationName.trim().toUpperCase() !== "MSO"
      ? settings.organizationName.trim()
      : "Mogh Students Organisation";

  // Monospace lists share one name width and one amount width, so every amount in the
  // message lines up in a single column.
  const lists: Array<[AmountRow[], string]> = [
    [savings, "Total savings"],
    [collected, "Total collected"],
    [newLoans, "Total loans issued"],
  ];
  const shown = lists.filter(([rows]) => rows.length);
  const w = Math.min(18, Math.max(0, ...shown.flatMap(([rows, label]) => [label.length, ...rows.map((r) => r.name.length)])));
  const aw = Math.max(0, ...shown.flatMap(([rows]) => [formatAmount(sum(rows)).length, ...rows.map((r) => formatAmount(r.amount).length)])) + 2;
  const table = (rows: AmountRow[], totalLabel: string) => {
    const name = (s: string) => (s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w));
    const lines = rows.map((r) => name(r.name) + formatAmount(r.amount).padStart(aw));
    lines.push("-".repeat(w + aw), name(totalLabel) + formatAmount(sum(rows)).padStart(aw));
    return "```" + lines.join("\n") + "```";
  };

  const out: string[] = [`*${orgName} (MSO)*`, `*Monthly Meeting: ${date(meeting.meeting_date)}*`];
  if (record.venue) out.push(`📍 ${record.venue}`);

  out.push("", "📝*Agenda*", meeting.agenda?.trim() || "-");
  if (meeting.decisions?.trim()) out.push("", "✅ *Decisions*", meeting.decisions.trim());

  if (attendance.length) {
    out.push("", `*Attendance: ${attendance.length - absent.length} of ${attendance.length} present*`);
    out.push(
      "",
      `*Absent members (${absent.length})*`,
      absent.length ? absent.map((n, i) => `${i + 1}. ${n}`).join("\n") : "None - all members were present.",
    );
  }

  out.push("", "*Savings*", savings.length ? table(savings, "Total savings") : "No members recorded.");

  out.push("", "*Loans collected*");
  out.push(collected.length ? table(collected, "Total collected") : "No loan repayments were received.");

  out.push("", `*Total collected (savings + loans): ${money(totals.totalCollected)}*`);

  if (newLoans.length) {
    out.push("", "*New loans issued*", table(newLoans, "Total loans issued"));
  }

  if (reserve.length) {
    out.push("", "*Reserve fund*");
    for (const t of reserve) out.push(`${t.transaction_type === "expense" ? "-" : "+"} ${reserveLabel(t)}: ${money(t.amount)}`);
  }

  if (next) out.push("", "*Next meeting*", [date(next.meeting_date), formatTime(next.meeting_time, settings), next.venue].filter(Boolean).join(" · "));

  return out.join("\n");
}

export async function buildMeetingShareMessage(meeting: DbMeeting, settings: ShareSettings): Promise<string> {
  return formatMeetingMessage(await getMeetingRecord(meeting), settings);
}
