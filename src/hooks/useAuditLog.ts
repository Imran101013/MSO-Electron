import { useEffect, useState } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete";
  changed_by: string | null;
  changed_at: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  // What the row points to, so lib/auditDescribe.ts can name it (null when it's gone).
  member_name?: string | null;
  member_father?: string | null;
  meeting_date?: string | null;
  loan_amount?: number | null;
  loan_date?: string | null;
  distribution_year?: number | null;
}

// The member, meeting, loan and distribution each entry refers to. A loan that has since been
// removed is read from its own audit entries.
const ENTRIES_SQL = `
  SELECT a.*, mem.name AS member_name, mem.father_name AS member_father,
    mt.meeting_date::text AS meeting_date,
    COALESCE(ln.amount, (lg.d->>'amount')::numeric) AS loan_amount,
    COALESCE(ln.loan_date::text, lg.d->>'loan_date') AS loan_date,
    pd.profit_year AS distribution_year
  FROM public.audit_log a
  CROSS JOIN LATERAL (SELECT COALESCE(a.new_data, a.old_data) AS d) r
  LEFT JOIN public.loans ln ON ln.id = (r.d->>'loan_id')::uuid
  LEFT JOIN LATERAL (
    SELECT COALESCE(x.new_data, x.old_data) AS d FROM public.audit_log x
    WHERE ln.id IS NULL AND r.d->>'loan_id' IS NOT NULL AND x.table_name = 'loans' AND x.record_id = (r.d->>'loan_id')::uuid
    ORDER BY x.changed_at DESC LIMIT 1
  ) lg ON true
  LEFT JOIN public.members mem ON mem.id = COALESCE((r.d->>'member_id')::uuid, ln.member_id, (lg.d->>'member_id')::uuid)
  LEFT JOIN public.meetings mt ON mt.id = (r.d->>'meeting_id')::uuid
  LEFT JOIN public.profit_distributions pd ON pd.id = (r.d->>'distribution_id')::uuid
  WHERE ($1::text = 'all' OR a.table_name = $1)
  ORDER BY a.changed_at DESC, a.id
  LIMIT $2 OFFSET $3`;

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  // Rows per page follows Settings → "Rows per page elsewhere".
  const pageSize = Math.max(1, useSettings().settings.itemsPerPage || 10);

  const fetchAuditLog = async (filter: string, pageIndex: number) => {
    setIsLoading(true);
    try {
      const rows = await dbQuery<AuditLogEntry>(ENTRIES_SQL, [filter, pageSize + 1, pageIndex * pageSize]);
      setHasMore(rows.length > pageSize);
      setEntries(rows.slice(0, pageSize));
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load audit log", variant: "destructive" });
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchAuditLog(tableFilter, page); }, [tableFilter, page, pageSize]);

  const changeTableFilter = (filter: string) => { setTableFilter(filter); setPage(0); };

  const deleteEntry = async (id: string) => {
    try {
      await dbQuery('DELETE FROM public.audit_log WHERE id=$1', [id]);
      toast({ title: "Entry Deleted", description: "The audit log entry has been removed." });
      await fetchAuditLog(tableFilter, page);
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to delete audit log entry", variant: "destructive" });
      return false;
    }
  };

  /** How many entries the whole log holds (for the Clear all confirmation). */
  const countAll = async () => {
    const [row] = await dbQuery<{ n: number }>("SELECT COUNT(*)::int AS n FROM public.audit_log");
    return Number(row?.n) || 0;
  };

  /** Deletes every entry. The records themselves are not touched. */
  const clearAll = async () => {
    try {
      const [row] = await dbQuery<{ n: number }>("WITH d AS (DELETE FROM public.audit_log RETURNING 1) SELECT COUNT(*)::int AS n FROM d");
      const n = Number(row?.n) || 0;
      toast({ title: "Audit log cleared", description: `${n} entr${n === 1 ? "y was" : "ies were"} removed.` });
      setPage(0);
      await fetchAuditLog(tableFilter, 0);
      return true;
    } catch {
      toast({ title: "Error", description: "Failed to clear the audit log", variant: "destructive" });
      return false;
    }
  };

  const refresh = () => fetchAuditLog(tableFilter, page);

  return { entries, tableFilter, setTableFilter: changeTableFilter, page, setPage, hasMore, isLoading, deleteEntry, countAll, clearAll, refresh };
}
