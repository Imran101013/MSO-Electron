import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { dbQuery } from "@/lib/db";
import { onMeetingSaved } from "@/lib/events";
import { useSettings, type Settings } from "@/contexts/SettingsContext";

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

type ReminderSettings = Pick<Settings, "backupReminderDays" | "backupReminderTrigger">;

/** When the records last changed and when the latest meeting was saved (ms), from the database. */
export interface ChangeTimes {
  change: number | null;
  meeting: number | null;
}

async function fetchChangeTimes(): Promise<ChangeTimes> {
  const [row] = await dbQuery<{ change: string | null; meeting: string | null }>(
    `SELECT (SELECT (EXTRACT(EPOCH FROM changed_at) * 1000)::bigint FROM public.data_last_changed LIMIT 1) AS change,
            (SELECT (EXTRACT(EPOCH FROM MAX(created_at)) * 1000)::bigint FROM public.meetings) AS meeting`,
  );
  const ms = (v: string | null | undefined) => (v === null || v === undefined ? null : Number(v));
  return { change: ms(row?.change), meeting: ms(row?.meeting) };
}

/**
 * Whether a reminder is due. Never backed up: always (unless reminders are off). Otherwise, by
 * the trigger: the last backup is at least `backupReminderDays` old, a meeting was saved after it,
 * or a record changed after it. `times` is null until loaded, and then nothing is due yet.
 */
export function isBackupDue(last: Date | null, reminder: ReminderSettings, times: ChangeTimes | null): boolean {
  const { backupReminderTrigger: trigger, backupReminderDays: days } = reminder;
  if (trigger === "age" && !(days > 0)) return false;
  if (!last) return true;
  if (trigger === "age") return differenceInCalendarDays(new Date(), last) >= days;
  const at = trigger === "meeting" ? times?.meeting : times?.change;
  return at !== null && at !== undefined && at > last.getTime();
}

/** The last backup and whether a reminder is due under Settings → Data safety, kept up to date. */
export function useBackupStatus(): { lastBackupAt: Date | null; due: boolean } {
  const { settings } = useSettings();
  const lastBackupAt = useLastBackupAt();
  const [times, setTimes] = useState<ChangeTimes | null>(null);
  const trigger = settings.backupReminderTrigger;
  useEffect(() => {
    if (trigger === "age") return;
    let active = true;
    const load = () => {
      fetchChangeTimes()
        .then((t) => { if (active) setTimes(t); })
        .catch(() => {});
    };
    load();
    // Changes made elsewhere in the app (or a backup made) are picked up without a reload.
    const offMeeting = onMeetingSaved(load);
    window.addEventListener(BACKUP_MADE_EVENT, load);
    window.addEventListener("focus", load);
    const timer = window.setInterval(load, 60_000);
    return () => {
      active = false;
      offMeeting();
      window.removeEventListener(BACKUP_MADE_EVENT, load);
      window.removeEventListener("focus", load);
      window.clearInterval(timer);
    };
  }, [trigger]);
  return { lastBackupAt, due: isBackupDue(lastBackupAt, settings, times) };
}

/** "today", "yesterday", "5 days ago". */
export function backupAge(last: Date): string {
  const days = differenceInCalendarDays(new Date(), last);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}
