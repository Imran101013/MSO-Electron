import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { History, Loader2, Eye, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuditLog, AuditLogEntry } from "@/hooks/useAuditLog";
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
  const { entries, tableFilter, setTableFilter, page, setPage, hasMore, isLoading, deleteEntry } = useAuditLog();
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<AuditLogEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
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
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-sm" onClick={() => setSelectedEntry(entry)}>
                            <Eye className="w-3.5 h-3.5" /> View
                          </Button>
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
                  ))}
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

      {/* Diff Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={(o) => { if (!o) setSelectedEntry(null); }}>
        <DialogContent className="sm:max-w-[640px] flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden rounded-sm">
          <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
            <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground capitalize">{selectedEntry?.action} on {selectedEntry?.table_name}</h2>
              <p className="figure text-xs text-muted-foreground">
                {selectedEntry && format(new Date(selectedEntry.changed_at), `${settings.dateFormat} ${timePattern(settings.timeFormat)}`)} · {selectedEntry?.changed_by || "unknown"}
              </p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Before</p>
              <pre className="figure text-xs bg-muted/50 rounded-sm p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {selectedEntry?.old_data ? JSON.stringify(selectedEntry.old_data, null, 2) : "—"}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">After</p>
              <pre className="figure text-xs bg-muted/50 rounded-sm p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {selectedEntry?.new_data ? JSON.stringify(selectedEntry.new_data, null, 2) : "—"}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
