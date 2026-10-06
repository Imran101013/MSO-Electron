import { format } from "date-fns";
import { formatTime } from "@/lib/utils";

/** What a circular needs to know about the meeting it announces (a scheduled meeting). */
export interface CircularMeeting {
  meeting_date: string;
  meeting_time: string | null;
  venue: string | null;
}

/** Words in braces that are filled in from the scheduled meeting when the circular is shared. */
export const CIRCULAR_FIELDS = [
  { token: "{تاریخ}", label: "Date" },
  { token: "{دن}", label: "Day" },
  { token: "{وقت}", label: "Time" },
  { token: "{جگہ}", label: "Venue" },
] as const;

// A yyyy-MM-dd key as a local date (parsed here, not via hooks/useLoans: SettingsContext imports this file).
const localDay = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };

const URDU_DAYS = ["اتوار", "پیر", "منگل", "بدھ", "جمعرات", "جمعہ", "ہفتہ"];

/**
 * The monthly circular as the Information Secretary sends it to the WhatsApp group, with the
 * date and day filled in from the scheduled meeting. Everything else is the secretary's own
 * wording; it can be changed in Settings, and again before each one is sent.
 */
export const DEFAULT_CIRCULAR = [
  "اسلام علیکم۔",
  "تمام ممبران کو اطلاع دی جاتی ہے کہ ایم ایس او کا ماہانہ اجلاس مورخہ {تاریخ} بروز {دن} شام کے دونوں دؤعاون کے بعد ہمارے ممبر جناب شفیق ادین صاحب(نیز )کے گھر میں رکھی گئی ہے_",
  "ممبران سے گزارش ہے کہ وقت کی پابندی کرتے ہوئے اجلاس میں شرکت کریں _",
  "(نوٹ)۔",
  "لون والے حضرات قسط کی رقم لانا نا بھولیں_",
  "(شکریہ)",
  "فقط۔",
  "انفارمیشن سکٹری",
  "کامران علی شاہ",
  "ایم ایس او",
].join("\n");

/** Each field's value for a meeting ("" where the meeting has none, e.g. no time set). */
export function circularValues(meeting: CircularMeeting, dateFormat: string, timeFormat: string): Record<string, string> {
  const day = localDay(meeting.meeting_date.slice(0, 10));
  return {
    "{تاریخ}": format(day, dateFormat || "dd/MM/yyyy"),
    "{دن}": URDU_DAYS[day.getDay()],
    "{وقت}": formatTime(meeting.meeting_time, timeFormat),
    "{جگہ}": meeting.venue?.trim() ?? "",
  };
}

/**
 * The circular for a meeting, each filled-in detail in WhatsApp bold so the date, day, time and
 * venue stand out (a field the format already puts between asterisks isn't bolded twice).
 * Without a meeting (or a value), the field is left in braces to fill by hand.
 */
export function fillCircular(template: string, meeting: CircularMeeting | null, dateFormat: string, timeFormat: string): string {
  if (!meeting) return template;
  const values = circularValues(meeting, dateFormat, timeFormat);
  return CIRCULAR_FIELDS.reduce((text, { token }) => {
    const value = values[token];
    if (!value) return text;
    return text
      .split(`*${token}*`)
      .map((part) => part.split(token).join(`*${value}*`))
      .join(`*${value}*`);
  }, template);
}

/** Fields still in braces (nothing to fill them with). */
export const unfilledFields = (text: string) => CIRCULAR_FIELDS.filter(({ token }) => text.includes(token));
