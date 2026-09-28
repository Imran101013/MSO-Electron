import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";

// When the last successful backup was made on this machine. Kept apart from the settings so
// "Reset to defaults" never forgets it.
const LAST_BACKUP_KEY = "mso_last_backup_at";
const BACKUP_MADE_EVENT = "backup:made";

export type BackupResult = { canceled?: boolean; error?: string; success?: boolean; path?: string };
type Bridge = { backupDatabase?: () => Promise<BackupResult>; restoreDatabase?: () => Promise<BackupResult> };

const bridge = () => (window as unknown as { electronAPI?: Bridge }).electronAPI;

export function getLastBackupAt(): Date | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_KEY);
    const d = raw ? new Date(raw) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  } catch {
    return null;
  }
}

/** Asks for a save location and writes every table to one JSON file; records the time on success. */
export async function backupDatabase(): Promise<BackupResult> {
  const api = bridge();
  if (!api?.backupDatabase) return { error: "Backups are available in the desktop app." };
  const res = await api.backupDatabase();
  if (res?.success) {
    try {
      localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    } catch {
      // The backup itself succeeded; only the reminder loses track.
    }
    window.dispatchEvent(new CustomEvent(BACKUP_MADE_EVENT));
  }
  return res ?? { error: "The backup did not complete." };
}

export async function restoreDatabase(): Promise<BackupResult> {
  const api = bridge();
  if (!api?.restoreDatabase) return { error: "Restoring is available in the desktop app." };
  return (await api.restoreDatabase()) ?? { error: "The restore did not complete." };
}

/** The last backup time, updated live when a backup is made anywhere in the app. */
export function useLastBackupAt(): Date | null {
  const [last, setLast] = useState<Date | null>(getLastBackupAt);
  useEffect(() => {
    const update = () => setLast(getLastBackupAt());
    window.addEventListener(BACKUP_MADE_EVENT, update);
    return () => window.removeEventListener(BACKUP_MADE_EVENT, update);
  }, []);
  return last;
}

/** Whether a reminder is due: never backed up, or the last backup is at least `reminderDays` old. */
export function isBackupDue(last: Date | null, reminderDays: number): boolean {
  if (!(reminderDays > 0)) return false;
  return !last || differenceInCalendarDays(new Date(), last) >= reminderDays;
}

/** "today", "yesterday", "5 days ago". */
export function backupAge(last: Date): string {
  const days = differenceInCalendarDays(new Date(), last);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}
