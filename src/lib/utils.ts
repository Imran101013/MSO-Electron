import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parse, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
