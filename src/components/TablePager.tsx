import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

export interface Paged<T> {
  /** The rows on the current page. */
  rows: T[];
  page: number;
  pages: number;
  setPage: (page: number) => void;
  pageSize: number;
  total: number;
  /** Rows before this page, for numbering rows across pages. */
  offset: number;
}

/**
 * Splits `rows` into pages of Settings → "Rows per page elsewhere". Goes back to the first page when
 * the setting or `resetKey` (e.g. the record a dialog shows) changes; pass a primitive.
 */
export function usePaged<T>(rows: T[], resetKey?: string | number | null): Paged<T> {
  const { settings } = useSettings();
  const pageSize = Math.max(1, Math.floor(Number(settings.itemsPerPage) || 10));
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  // Rows can shrink under the current page (a filter, a deletion): stay on the last page there is.
  const current = Math.min(page, pages);
  const offset = (current - 1) * pageSize;
  const pageRows = useMemo(() => rows.slice(offset, offset + pageSize), [rows, offset, pageSize]);
  return { rows: pageRows, page: current, pages, setPage, pageSize, total: rows.length, offset };
}

/** Previous / next strip under a paged table; renders nothing when everything fits on one page. */
export function TablePager<T>({ paged, noun = "rows", className }: { paged: Paged<T>; noun?: string; className?: string }) {
  if (paged.pages <= 1) return null;
  const from = paged.offset + 1;
  const to = Math.min(paged.total, paged.offset + paged.pageSize);
  return (
    <nav aria-label={`Pages of ${noun}`} className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 px-4 py-2", className)}>
      <span className="figure text-xs text-muted-foreground">
        {from}–{to} of {paged.total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 rounded-sm px-2 text-xs" onClick={() => paged.setPage(paged.page - 1)} disabled={paged.page <= 1}>
          <ChevronLeft className="h-3 w-3" /> Previous
        </Button>
        <span className="figure text-xs text-muted-foreground" aria-live="polite">
          Page {paged.page} of {paged.pages}
        </span>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1 rounded-sm px-2 text-xs" onClick={() => paged.setPage(paged.page + 1)} disabled={paged.page >= paged.pages}>
          Next <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </nav>
  );
}
