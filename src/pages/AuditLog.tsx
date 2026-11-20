import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { History, Loader2, Undo2, ChevronLeft, ChevronRight, Trash2, Eye, Eraser } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuditLog, AuditLogEntry } from "@/hooks/useAuditLog";
import { parseLocalDate } from "@/hooks/useLoans";
import { useToast } from "@/hooks/use-toast";
import { prepareUndo, undoKind, type PreparedUndo, type UndoFormat } from "@/lib/auditUndo";
import { ACTION_LABEL, AUDIT_AREAS, describeEntry } from "@/lib/auditDescribe";
import { timePattern } from "@/lib/utils";

const AUDITED_TABLES = [{ value: "all", label: "All changes" }, ...Object.entries(AUDIT_AREAS).map(([value, label]) => ({ value, label }))];

const ACTION_BADGE_VARIANT: Record<AuditLogEntry["action"], "secondary" | "default" | "destructive"> = {
  insert: "secondary",
  update: "default",
  delete: "destructive",
};

export default function AuditLog() {
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const { refreshData } = useOrganization();
  const { toast } = useToast();
  const { entries, tableFilter, setTableFilter, page, setPage, hasMore, isLoading, deleteEntry, countAll, clearAll, refresh } = useAuditLog();
  const [entryToView, setEntryToView] = useState<AuditLogEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<AuditLogEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Clear all: the number of entries it will remove (null while the confirmation is closed).
  const [clearCount, setClearCount] = useState<number | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  // Undo: the entry being checked against the records, then the confirmation saying what will change.
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PreparedUndo | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const undoFormat: UndoFormat = {
    day: (key) => format(parseLocalDate(key), settings.dateFormat),
    money: (n) => `${settings.currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    dateFormat: settings.dateFormat,
  };
  const when = (entry: AuditLogEntry) => format(new Date(entry.changed_at), `${settings.dateFormat} ${timePattern(settings.timeFormat)}`);

  const startUndo = async (entry: AuditLogEntry) => {
    setCheckingId(entry.id);
    try {
      const prepared = await prepareUndo(entry, undoFormat);
      if ("reason" in prepared) toast({ title: "Can't undo this change", description: prepared.reason, variant: "destructive" });
      else {
        setEntryToView(null);
        setPendingUndo(prepared);
      }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to check the change", variant: "destructive" });
    } finally {
      setCheckingId(null);
    }
  };

  const handleUndoConfirm = async () => {
    if (!pendingUndo) return;
    setIsUndoing(true);
    try {
      const message = await pendingUndo.run();
      toast({ title: "Change undone", description: message });
      await refresh();
      // Other pages read the shared records, which this has just changed.
      refreshData().catch(() => {});
    } catch (err: unknown) {
      toast({ title: "Not undone", description: err instanceof Error ? err.message : "Failed to undo the change", variant: "destructive" });
    } finally {
      setIsUndoing(false);
      setPendingUndo(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    await deleteEntry(entryToDelete.id);
    setIsDeleting(false);
    setEntryToDelete(null);
  };

  const openClearAll = async () => {
    try {
      setClearCount(await countAll());
    } catch {
      toast({ title: "Error", description: "Failed to count the audit log entries", variant: "destructive" });
    }
  };

  const handleClearConfirm = async () => {
    setIsClearing(true);
    await clearAll();
    setIsClearing(false);
    setClearCount(null);
  };

  const viewed = entryToView ? describeEntry(entryToView, undoFormat) : null;
  const viewedUndo = entryToView ? undoKind(entryToView) : null;
  const toDelete = entryToDelete ? describeEntry(entryToDelete, undoFormat) : null;
  // An update lists before and after; an addition only what was recorded, a removal what was removed.
  const columns = entryToView?.action === "update" ? ["Before", "After"] : entryToView?.action === "delete" ? ["Removed"] : ["Recorded"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 ledger-head pb-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mt-1">Audit Log</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Every financial record change, automatically tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="w-[200px] h-9 rounded-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AUDITED_TABLES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-sm text-destructive hover:text-destructive"
              disabled={isLoading || (entries.length === 0 && page === 0 && tableFilter === "all")}
              onClick={openClearAll}
            >
              <Eraser className="w-3.5 h-3.5" /> Clear all
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-sm rounded-sm ledger-sheet">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
              <History className="w-4 h-4 text-primary" />
            </div>
            Change History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-sm border-2 border-border bg-muted flex items-center justify-center mx-auto mb-3">
                <History className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No changes recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead>What happened</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const undo = undoKind(entry);
                    const d = describeEntry(entry, undoFormat);
                    return (
                    <TableRow key={entry.id}>
                      <TableCell className="figure text-sm text-muted-foreground whitespace-nowrap align-top">
                        {when(entry)}
                      </TableCell>
                      <TableCell className="align-top min-w-[280px]">
                        <div className="flex items-center gap-2">
                          <Badge variant={ACTION_BADGE_VARIANT[entry.action]} className="shrink-0">{ACTION_LABEL[entry.action]}</Badge>
                          <span className="text-sm font-medium">{d.title}</span>
                        </div>
                        {d.detail && <p className="mt-1 text-xs text-muted-foreground">{d.detail}</p>}
                      </TableCell>
                      <TableCell className="text-sm align-top">{entry.changed_by || "—"}</TableCell>
                      <TableCell className="text-right align-top">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-sm" onClick={() => setEntryToView(entry)}>
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
                          {/* Only changes the app can reverse get an Undo; View says why the others can't.
                              An empty slot keeps the buttons lined up down the table. */}
                          {isAdmin && (undo.kind ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 rounded-sm"
                              disabled={checkingId !== null || isUndoing}
                              onClick={() => startUndo(entry)}
                            >
                              {checkingId === entry.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Undo
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="invisible gap-1.5 rounded-sm" tabIndex={-1} aria-hidden>
                              <Undo2 className="w-3.5 h-3.5" /> Undo
                            </Button>
                          ))}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 rounded-sm text-destructive hover:text-destructive"
                              onClick={() => setEntryToDelete(entry)}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="rounded-sm gap-1.5" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </Button>
        <Button variant="outline" size="sm" className="rounded-sm gap-1.5" disabled={!hasMore} onClick={() => setPage(page + 1)}>
          Next <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* View: the entry in words, with its values */}
      <Dialog open={!!entryToView} onOpenChange={(o) => { if (!o) setEntryToView(null); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {entryToView && viewed && viewedUndo && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant={ACTION_BADGE_VARIANT[entryToView.action]}>{ACTION_LABEL[entryToView.action]}</Badge>
                  <DialogTitle>{viewed.title}</DialogTitle>
                </div>
                <DialogDescription>{viewed.detail}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">When</dt>
                <dd className="figure">{when(entryToView)}</dd>
                <dt className="text-muted-foreground">Changed by</dt>
                <dd>{entryToView.changed_by || "—"}</dd>
                <dt className="text-muted-foreground">Area</dt>
                <dd>{AUDIT_AREAS[entryToView.table_name] ?? "All records"}</dd>
              </dl>
              {viewed.fields.length > 0 && (
                <div className="rounded-sm border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-9">Detail</TableHead>
                        {columns.map((c) => <TableHead key={c} className="text-xs font-semibold uppercase tracking-wider h-9">{c}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewed.fields.map((f) => (
                        <TableRow key={f.label} className="hover:bg-transparent">
                          <TableCell className="py-2 text-sm text-muted-foreground">{f.label}</TableCell>
                          {entryToView.action === "update" ? (
                            <>
                              <TableCell className="py-2 text-sm">{f.before}</TableCell>
                              <TableCell className="py-2 text-sm font-medium">{f.after}</TableCell>
                            </>
                          ) : (
                            <TableCell className="py-2 text-sm">{entryToView.action === "delete" ? f.before : f.after}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="rounded-sm border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <span className="font-medium">Undo: </span>
                {viewedUndo.kind ? "This change can be undone with the Undo button." : <span className="text-muted-foreground">{viewedUndo.reason}</span>}
              </div>
              <DialogFooter>
                {isAdmin && viewedUndo.kind && (
                  <Button variant="outline" className="gap-1.5" disabled={checkingId !== null || isUndoing} onClick={() => startUndo(entryToView)}>
                    {checkingId === entryToView.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Undo
                  </Button>
                )}
                <Button onClick={() => setEntryToView(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Undo Confirmation */}
      <AlertDialog open={!!pendingUndo} onOpenChange={(o) => { if (!o && !isUndoing) setPendingUndo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingUndo?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingUndo?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUndoing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Stays open until the undo has finished.
                e.preventDefault();
                handleUndoConfirm();
              }}
              disabled={isUndoing}
            >
              {isUndoing ? "Undoing…" : "Undo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!entryToDelete} onOpenChange={(o) => { if (!o) setEntryToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this audit log entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && <>Removes “{toDelete.title}{toDelete.detail ? `: ${toDelete.detail}` : ""}” from the audit log. </>}
              The record itself is not changed, but this change can no longer be undone. Deleting an entry can't be reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear all Confirmation */}
      <AlertDialog open={clearCount !== null} onOpenChange={(o) => { if (!o && !isClearing) setClearCount(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear the whole audit log?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently deletes all {clearCount} entr{clearCount === 1 ? "y" : "ies"}, whatever the filter shows. Your records
              (members, savings, loans, reserve fund and meetings) are not changed, but none of these past changes can be undone
              afterwards. This can't be reversed, except by restoring a backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleClearConfirm();
              }}
              disabled={isClearing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isClearing ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
