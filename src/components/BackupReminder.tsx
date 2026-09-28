import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { DatabaseBackup, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { backupAge, backupDatabase, isBackupDue, useLastBackupAt } from "@/lib/backup";

/** Shown on the Dashboard once a backup is due (Settings → Data safety → reminder interval). */
export default function BackupReminder() {
  const { settings } = useSettings();
  const lastBackupAt = useLastBackupAt();
  const [busy, setBusy] = useState(false);

  if (!isBackupDue(lastBackupAt, settings.backupReminderDays)) return null;

  const runBackup = async () => {
    setBusy(true);
    try {
      const res = await backupDatabase();
      if (res.canceled) return;
      if (res.error) toast.error("Backup failed", { description: res.error });
      else toast.success("Backup saved", { description: res.path });
    } catch {
      toast.error("Backup failed", { description: "The database could not be written to a file." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-accent/50 bg-accent/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-sm border-2 border-accent/50 bg-accent/15 text-primary flex items-center justify-center shrink-0">
          <DatabaseBackup className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {lastBackupAt ? `Time for a backup: the last one was ${backupAge(lastBackupAt)}` : "No backup has been made on this computer yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Every record is stored only on this computer. A backup saves it all to a file you choose.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild variant="ghost" size="sm" className="rounded-sm">
          <Link to="/settings">Reminder settings</Link>
        </Button>
        <Button size="sm" onClick={runBackup} disabled={busy} className="gap-2 rounded-sm">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DatabaseBackup className="w-3.5 h-3.5" />}
          {busy ? "Backing up…" : "Back up now"}
        </Button>
      </div>
    </div>
  );
}
