import { useEffect, useState } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

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

const PAGE_SIZE = 25;

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAuditLog = async (filter: string, pageIndex: number) => {
    setIsLoading(true);
    try {
      const offset = pageIndex * PAGE_SIZE;
      const rows = filter === "all"
        ? await dbQuery<AuditLogEntry>(
            'SELECT * FROM public.audit_log ORDER BY changed_at DESC LIMIT $1 OFFSET $2',
            [PAGE_SIZE + 1, offset]
          )
        : await dbQuery<AuditLogEntry>(
            'SELECT * FROM public.audit_log WHERE table_name=$1 ORDER BY changed_at DESC LIMIT $2 OFFSET $3',
            [filter, PAGE_SIZE + 1, offset]
          );
      setHasMore(rows.length > PAGE_SIZE);
      setEntries(rows.slice(0, PAGE_SIZE));
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load audit log", variant: "destructive" });
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchAuditLog(tableFilter, page); }, [tableFilter, page]);

  const changeTableFilter = (filter: string) => { setTableFilter(filter); setPage(0); };

  return { entries, tableFilter, setTableFilter: changeTableFilter, page, setPage, hasMore, isLoading };
}
