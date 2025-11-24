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

/**
 * Converts a 24-hour time string ("HH:mm") to 12-hour time format with AM/PM ("hh:mm a").
 * Returns empty string if input is invalid.
 */
export function formatTimeTo12Hour(time24: string): string {
  if (!time24) return "";
  const parsedTime = parse(time24, "HH:mm", new Date());
  if (!isValid(parsedTime)) return "";
  return format(parsedTime, "hh:mm a");
}

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
