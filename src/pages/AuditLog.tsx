import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { History, Loader2, Undo2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuditLog, AuditLogEntry } from "@/hooks/useAuditLog";
import { parseLocalDate } from "@/hooks/useLoans";
import { useToast } from "@/hooks/use-toast";
import { prepareUndo, undoKind, type PreparedUndo, type UndoFormat } from "@/lib/auditUndo";
import { timePattern } from "@/lib/utils";

const AUDITED_TABLES = [
  { value: "all", label: "All Tables" },
  { value: "loans", label: "Loans" },
  { value: "loan_installments", label: "Loan Installments" },
  { value: "loan_schedule", label: "Loan Schedule" },
  { value: "loan_penalties", label: "Loan Penalties" },
  { value: "monthly_contributions", label: "Contributions" },
  { value: "attendance", label: "Attendance" },
  { value: "reserve_transactions", label: "Reserve Transactions" },
  { value: "profit_distributions", label: "Profit Distributions" },
  { value: "profit_allocations", label: "Profit Allocations" },
];

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
  const { entries, tableFilter, setTableFilter, page, setPage, hasMore, isLoading, deleteEntry, refresh } = useAuditLog();
  const [entryToDelete, setEntryToDelete] = useState<AuditLogEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Undo: the entry being checked against the records, then the confirmation saying what will change.
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<PreparedUndo | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const undoFormat: UndoFormat = {
    day: (key) => format(parseLocalDate(key), settings.dateFormat),
    money: (n) => `${settings.currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    dateFormat: settings.dateFormat,
  };

  const startUndo = async (entry: AuditLogEntry) => {
    setCheckingId(entry.id);
    try {
      const prepared = await prepareUndo(entry, undoFormat);
      if ("reason" in prepared) toast({ title: "Can't undo this change", description: prepared.reason, variant: "destructive" });
      else setPendingUndo(prepared);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b-2 border-accent/70 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
            <History className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mt-1">Audit Log</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Every financial record change, automatically tracked</p>
          </div>
        </div>
        <Select value={tableFilter} onValueChange={setTableFilter}>
          <SelectTrigger className="w-[200px] h-9 rounded-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AUDITED_TABLES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="shadow-sm rounded-sm border-t-2 border-t-accent">
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
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">When</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Table</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Action</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Changed By</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const undo = undoKind(entry);
                    return (
                    <TableRow key={entry.id} className="hover:bg-muted/30">
                      <TableCell className="figure text-sm text-muted-foreground">
                        {format(new Date(entry.changed_at), `${settings.dateFormat} ${timePattern(settings.timeFormat)}`)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{entry.table_name}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_BADGE_VARIANT[entry.action]} className="capitalize">{entry.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entry.changed_by || "unknown"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
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
                            // A disabled button gets no hover, so the reason is on its wrapper.
                            <span title={undo.reason} className="inline-flex">
                              <Button variant="ghost" size="sm" className="gap-1.5 rounded-sm" disabled aria-label={`Undo: ${undo.reason}`}>
                                <Undo2 className="w-3.5 h-3.5" /> Undo
                              </Button>
                            </span>
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
              This permanently removes the {entryToDelete?.action} record for {entryToDelete?.table_name} from the audit trail. This cannot be undone.
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
    </div>
  );
}
