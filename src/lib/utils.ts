import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parse, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(
  date: Date | string,
  dateFormat = "dd/MM/yyyy"
): string {
  return format(new Date(date), dateFormat);
}

/** date-fns pattern for a clock time under the 12/24-hour setting. */
export const timePattern = (timeFormat?: string) => (timeFormat === "24" ? "HH:mm" : "hh:mm a");

/**
 * Formats a stored 24-hour time ("HH:mm" or "HH:mm:ss") under the 12/24-hour setting.
 * Returns empty string if input is invalid.
 */
export function formatTime(time24: string | null | undefined, timeFormat?: string): string {
  if (!time24) return "";
  // Postgres TIME columns come back with seconds ("20:00:00"); only hours and minutes are shown.
  const parsedTime = parse(time24.slice(0, 5), "HH:mm", new Date());
  if (!isValid(parsedTime)) return "";
  return format(parsedTime, timePattern(timeFormat));
}

/** A stored 24-hour time as 12-hour with AM/PM ("hh:mm a"). */
export const formatTimeTo12Hour = (time24: string) => formatTime(time24, "12");

/**
 * Converts a 12-hour time format string with AM/PM ("hh:mm a") to 24-hour time string ("HH:mm").
 * Returns empty string if input is invalid.
 */
export function parseTimeFrom12Hour(time12: string): string {
  if (!time12) return "";
  const parsedTime = parse(time12, "hh:mm a", new Date());
  if (!isValid(parsedTime)) return "";
  return format(parsedTime, "HH:mm");
}
