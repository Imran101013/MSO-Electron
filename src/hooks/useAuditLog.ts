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
}

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
      const offset = pageIndex * pageSize;
      const rows = filter === "all"
        ? await dbQuery<AuditLogEntry>(
            'SELECT * FROM public.audit_log ORDER BY changed_at DESC LIMIT $1 OFFSET $2',
            [pageSize + 1, offset]
          )
        : await dbQuery<AuditLogEntry>(
            'SELECT * FROM public.audit_log WHERE table_name=$1 ORDER BY changed_at DESC LIMIT $2 OFFSET $3',
            [filter, pageSize + 1, offset]
          );
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

  return { entries, tableFilter, setTableFilter: changeTableFilter, page, setPage, hasMore, isLoading, deleteEntry };
}
