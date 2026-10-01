import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileDown, FileUp, Loader2, Trash2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSettings } from "@/contexts/SettingsContext";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { backupDatabase } from "@/lib/backup";
import {
  clearAllRecords,
  firstBookDay,
  importOpeningBalances,
  readOpeningFile,
  recordCounts,
  removeOpeningBalances,
  saveOpeningTemplate,
  setCutoverDate,
  useBooksConfig,
  type RawOpeningFile,
} from "@/lib/books";
import { checkOpeningFile, type OpeningCheck, type OpeningIssue } from "@/utils/openingBalances";
import { cn } from "@/lib/utils";

const keyOf = (d: Date) => format(d, "yyyy-MM-dd");
const dayOf = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Takes a backup first; returns false (and says why) if it was cancelled or failed. */
async function backupFirst(what: string): Promise<boolean> {
  const res = await backupDatabase();
  if (res.success) return true;
  if (res.canceled) toast.info(`${what} was not done`, { description: "A backup is saved first. Choose where to save it to continue." });
  else toast.error("Backup failed", { description: res.error || "The database could not be written to a file." });
  return false;
}

/** Settings section: the cut-over date and the opening balances brought in from the registers. */
export function PaperRegistersCard() {
  const { settings } = useSettings();
  const { config, loading } = useBooksConfig();
  const [picked, setPicked] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<null | "template" | "read" | "remove">(null);
  const [check, setCheck] = useState<OpeningCheck | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const cur = settings.currency;
  const fmt = (key: string) => format(dayOf(key), settings.dateFormat);
  const money = (n: number) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const cutover = config.cutoverDate;
  const opening = config.opening;
  const pendingKey = picked ? keyOf(picked) : null;
  const dateChanged = pendingKey !== null && pendingKey !== cutover;

  const saveDate = async (key: string | null) => {
    setSaving(true);
    try {
      const res = await setCutoverDate(key);
      if (res.error) toast.error(key ? "Cut-over date not set" : "Cut-over date not removed", { description: res.error });
      else {
        setPicked(undefined);
        toast.success(key ? `Cut-over date set to ${fmt(key)}` : "Cut-over date removed", {
          description: key ? `Entries dated ${fmt(key)} or earlier are now refused. Next, download the template.` : "Every date is open for entries again.",
        });
      }
    } catch {
      toast.error("The cut-over date could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    if (!cutover) return;
    setBusy("template");
    try {
      const res = await saveOpeningTemplate(cutover, cur);
      if (res.error) toast.error("Template not saved", { description: res.error });
      else if (res.success) toast.success("Template saved", { description: res.path });
    } finally {
      setBusy(null);
    }
  };

  const chooseFile = async () => {
    if (!cutover) return;
    setBusy("read");
    try {
      const res = await readOpeningFile();
      if (res.canceled) return;
      if (res.error) {
        toast.error("File not read", { description: res.error });
        return;
      }
      setCheck(checkOpeningFile(res as RawOpeningFile, cutover, settings.dateFormat, cur));
    } finally {
      setBusy(null);
    }
  };

  const removeOpening = async () => {
    setRemoveOpen(false);
    setBusy("remove");
    try {
      if (!(await backupFirst("Removing the opening balances"))) return;
      const res = await removeOpeningBalances();
      if (res.error) toast.error("Opening balances not removed", { description: res.error });
      else {
        toast.success("Opening balances removed", { description: "Reloading…" });
        setTimeout(() => window.location.reload(), 1200);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-sm shadow-sm">
      <div className="px-5 pt-5 pb-1">
        <h3 className="text-base font-bold text-foreground">Moving from paper registers</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[68ch]">
          The cut-over date is the last day kept in the paper registers. The balances on that day are brought in once from an Excel
          file; from the next day, every entry is made in the app.
        </p>
      </div>

      <div className="divide-y divide-border px-5">
        {/* Cut-over date */}
        <Row
          label="Cut-over date"
          help={
            loading ? (
              "Reading…"
            ) : cutover ? (
              <>
                Records up to <span className="figure text-foreground">{fmt(cutover)}</span> are in the paper registers. The app keeps the
                books from <span className="figure text-foreground">{fmt(firstBookDay(cutover))}</span>, and any contribution, loan,
                repayment, reserve entry or profit distribution dated earlier is refused.
              </>
            ) : (
              "Not set yet. Until it is, every date is open for entries."
            )
          }
        >
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <div className="w-52">
              <DatePicker
                date={picked ?? (cutover ? dayOf(cutover) : undefined)}
                onDateChange={setPicked}
                placeholder="Last register day"
                className="h-10 rounded-sm"
              />
            </div>
            <Button type="button" onClick={() => pendingKey && saveDate(pendingKey)} disabled={!dateChanged || saving || !!opening} className="gap-2 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {cutover ? "Change date" : "Set date"}
            </Button>
            {cutover && !opening && (
              <Button type="button" variant="ghost" onClick={() => saveDate(null)} disabled={saving} className="rounded-sm">
                Remove
              </Button>
            )}
          </div>
          <span className="text-xs text-muted-foreground sm:text-right">
            {opening ? "Remove the opening balances below to change the date." : "The date can't be set after any entry already in the app."}
          </span>
        </Row>

        {/* Opening balances */}
        <Row
          label="Opening balances"
          help={
            <>
              1. Download the template and fill it in from the registers: each member's savings, every loan still unpaid, and the reserve
              fund, as at the cut-over date. 2. Import it: every row is checked and the totals are shown before anything is saved.
              Importing again replaces the opening balances.
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={downloadTemplate} disabled={!cutover || busy !== null} className="gap-2 rounded-sm">
              {busy === "template" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
              Download template
            </Button>
            <Button type="button" onClick={chooseFile} disabled={!cutover || busy !== null} className="gap-2 rounded-sm">
              {busy === "read" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
              {opening ? "Import again" : "Import filled file"}
            </Button>
          </div>
          <span className="text-xs text-muted-foreground sm:text-right">{cutover ? "" : "Set the cut-over date first."}</span>
        </Row>

        {opening && (
          <div className="flex items-start gap-3 py-4">
            <Badge variant="secondary" className="mt-0.5 shrink-0">Imported</Badge>
            <p className="text-sm text-foreground">
              <span className="figure">{format(new Date(opening.importedAt), settings.dateFormat)}</span>
              {opening.fileName ? <span className="text-muted-foreground"> from {opening.fileName}</span> : null}:{" "}
              <span className="figure">{opening.members}</span> members with savings of <span className="figure">{money(opening.savings)}</span>,{" "}
              <span className="figure">{opening.loans}</span> open loan{opening.loans === 1 ? "" : "s"}, reserve fund{" "}
              <span className="figure">{money(opening.reserve)}</span>
              {opening.profit ? (
                <>
                  , and the {opening.profit.year} profit not yet shared: bank profit <span className="figure">{money(opening.profit.bankProfit)}</span>, interest{" "}
                  <span className="figure">{money(opening.profit.interest)}</span>, penalties <span className="figure">{money(opening.profit.penalties)}</span>,{" "}
                  <span className="figure">{opening.profit.absences}</span> absences
                </>
              ) : null}
              .
            </p>
          </div>
        )}
      </div>

      {opening && (
        <div className="flex flex-col gap-3 border-t border-border bg-destructive/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Remove opening balances</p>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-[68ch]">
              Takes out everything the import brought in, so the cut-over date can be changed. Not possible once repayments have been
              recorded on an opening loan; import a corrected file instead.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRemoveOpen(true)}
            disabled={busy !== null}
            className="gap-2 rounded-sm shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {busy === "remove" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Remove opening balances
          </Button>
        </div>
      )}

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the opening balances?</AlertDialogTitle>
            <AlertDialogDescription>
              The members' opening savings, the open loans and the reserve balance brought in from the registers are taken out. Members
              the import added are removed too, unless something else has been recorded for them. A backup is saved first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeOpening} className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Back up, then remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportPreview check={check} replacing={!!opening} onClose={() => setCheck(null)} />
    </Card>
  );
}

function Row({ label, help, children }: { label: string; help: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-6">
      <div className="min-w-0">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[68ch]">{help}</p>
      </div>
      <div className="flex flex-col gap-1 sm:items-end">{children}</div>
    </div>
  );
}

/** The check before an import: totals to compare with the registers, and every problem by row. */
function ImportPreview({ check, replacing, onClose }: { check: OpeningCheck | null; replacing: boolean; onClose: () => void }) {
  const { settings } = useSettings();
  const [importing, setImporting] = useState(false);
  const cur = settings.currency;
  const money = (n: number) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmt = (key: string) => format(dayOf(key), settings.dateFormat);

  const runImport = async () => {
    if (!check || check.problems.length > 0) return;
    setImporting(true);
    try {
      if (!(await backupFirst("The import"))) return;
      const res = await importOpeningBalances({
        cutoverDate: check.cutoverDate,
        fileName: check.fileName,
        termMonths: ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS,
        penaltyPerMonth: settings.latePenaltyPerMonth,
        members: check.members.map(({ regNo, name, fatherName, phone, address, joinDate, savings, absences }) => ({ regNo, name, fatherName, phone, address, joinDate, savings, absences })),
        loans: check.loans.map(({ regNo, loanDate, amount, interest, repaid, penalties, defaulted }) => ({ regNo, loanDate, amount, interest, repaid, penalties, defaulted })),
        reserve: check.reserve,
        profit: check.profit,
      });
      if (res.error) {
        toast.error("Nothing was imported", { description: res.error });
        return;
      }
      toast.success("Opening balances imported", { description: `${check.totals.members} members and ${check.totals.loans} open loans. Reloading…` });
      onClose();
      setTimeout(() => window.location.reload(), 1200);
    } finally {
      setImporting(false);
    }
  };

  const t = check?.totals;
  return (
    <Dialog open={!!check} onOpenChange={(o) => { if (!o && !importing) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-sm max-h-[90vh] overflow-y-auto">
        {check && t && (
          <>
            <DialogHeader>
              <DialogTitle>Check the opening balances</DialogTitle>
              <DialogDescription>
                {check.fileName ? `${check.fileName} · ` : ""}balances as at <span className="figure">{fmt(check.cutoverDate)}</span>. Compare these totals
                with the register totals before importing.
              </DialogDescription>
            </DialogHeader>

            <dl className="rounded-sm border border-border px-4 py-3 space-y-2 text-sm">
              <Total label="Members" value={t.members.toLocaleString()} />
              <Total label="Total savings" value={money(t.savings)} />
              <Total label="Open loans" value={t.loans.toLocaleString()} />
              <Total label="Still owed on those loans" note="lent + interest + penalties − repaid" value={money(t.owed)} />
              <Total label="Reserve fund" value={money(t.reserve)} />
              {check.profit && (
                <div className="border-t border-border pt-2 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Profit for {check.profit.year} not yet shared (July {check.profit.year + 1} AGM)</p>
                  <Total label="Bank profit" value={money(check.profit.bankProfit)} />
                  <Total label="Loan interest collected" value={money(check.profit.interest)} />
                  <Total label="Late penalties collected" value={money(check.profit.penalties)} />
                  <Total label="Absences" note="meetings members were marked absent at" value={t.absences.toLocaleString()} />
                </div>
              )}
              <div className="border-t border-border pt-2">
                <Total
                  label="Money in the bank, worked out"
                  note={check.profit ? "savings + reserve + profit not yet shared − what is still out on loan" : "savings + reserve − what is still out on loan"}
                  value={money(t.bank)}
                  strong
                />
                <p className="text-xs text-muted-foreground mt-1">Should match the bank statement for the cut-over date.</p>
              </div>
            </dl>

            {check.problems.length > 0 ? (
              <IssueList
                tone="bad"
                title={`${check.problems.length} problem${check.problems.length === 1 ? "" : "s"} to fix in the file first`}
                items={check.problems}
              />
            ) : (
              <p className="flex items-center gap-2 text-sm text-secondary">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> No problems found. The file can be imported.
              </p>
            )}
            {check.warnings.length > 0 && (
              <IssueList tone="warn" title={`${check.warnings.length} thing${check.warnings.length === 1 ? "" : "s"} to check`} items={check.warnings} />
            )}
            {replacing && check.problems.length === 0 && (
              <p className="text-xs text-muted-foreground">This replaces the opening balances imported earlier. Entries made in the app since the cut-over stay as they are.</p>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={importing} className="rounded-sm">
                {check.problems.length > 0 ? "Close and fix the file" : "Cancel"}
              </Button>
              <Button type="button" onClick={runImport} disabled={importing || check.problems.length > 0} className="gap-2 rounded-sm">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                {importing ? "Importing…" : "Back up, then import"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Total({ label, note, value, strong }: { label: string; note?: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={cn("min-w-0 truncate", strong ? "font-semibold text-foreground" : "text-foreground")}>
          {label}
          {note && <span className="ml-1.5 text-xs text-muted-foreground">({note})</span>}
        </span>
        <span aria-hidden className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-border" />
      </dt>
      <dd className={cn("figure shrink-0", strong ? "font-bold" : "font-semibold")}>{value}</dd>
    </div>
  );
}

function IssueList({ tone, title, items }: { tone: "bad" | "warn"; title: string; items: OpeningIssue[] }) {
  const Icon = tone === "bad" ? XCircle : AlertTriangle;
  return (
    <div className={cn("rounded-sm border px-4 py-3", tone === "bad" ? "border-destructive/40 bg-destructive/[0.04]" : "border-accent/50 bg-accent/10")}>
      <p className={cn("flex items-center gap-2 text-sm font-semibold", tone === "bad" ? "text-destructive" : "text-primary")}>
        <Icon className="w-4 h-4 shrink-0" /> {title}
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-foreground">
        {items.map((it, i) => (
          <li key={i}>
            <span className="font-medium">{it.sheet}{it.row ? `, row ${it.row}` : ""}:</span> {it.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Data safety footer strip: deletes every record (for clearing test data before the real start). */
export function ClearRecordsStrip() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof recordCounts>> | null>(null);
  const [typed, setTyped] = useState("");
  const [clearing, setClearing] = useState(false);

  const start = async () => {
    setTyped("");
    setCounts(null);
    setOpen(true);
    try {
      setCounts(await recordCounts());
    } catch {
      setCounts(null);
    }
  };

  const run = async () => {
    setOpen(false);
    setClearing(true);
    try {
      if (!(await backupFirst("Clearing"))) return;
      const res = await clearAllRecords();
      if (res.error) toast.error("Records not cleared", { description: res.error });
      else {
        toast.success("All records cleared", { description: "Reloading…" });
        setTimeout(() => window.location.reload(), 1200);
      }
    } finally {
      setClearing(false);
    }
  };

  const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
  const summary = counts
    ? [
        plural(counts.members, "member"),
        plural(counts.meetings, "meeting"),
        plural(counts.contributions, "contribution"),
        plural(counts.loans, "loan"),
        plural(counts.reserve, "reserve fund entry", "reserve fund entries"),
        plural(counts.distributions, "profit distribution"),
      ].join(", ")
    : null;

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-destructive/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">Clear all records</p>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-[68ch]">
          Deletes every member, meeting, contribution, loan and reserve entry, for removing test data before the real start. The admin
          login, the settings and the cut-over date stay.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={start}
        disabled={clearing}
        className="gap-2 rounded-sm shrink-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        {clearing ? "Clearing…" : "Clear all records"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete every record?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{summary ? `This deletes ${summary}, and the audit log.` : "Counting the records…"}</p>
                <p>A backup is saved first. Apart from restoring that backup, this cannot be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-clear" className="text-xs font-medium">Type CLEAR to confirm</Label>
            <Input id="confirm-clear" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="rounded-sm" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={run}
              disabled={typed.trim().toUpperCase() !== "CLEAR"}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Back up, then clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
