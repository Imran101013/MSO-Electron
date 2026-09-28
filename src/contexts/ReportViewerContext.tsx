import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { jsPDF } from "jspdf";
import { AlertTriangle, Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { buildBooks } from "@/utils/accounting";
import { buildReport, reportTitle, type ReportRequest } from "@/utils/pdfReports";

interface ReportViewerContextType {
  /** Reloads the records, builds the report and shows it, with a Download button. */
  openReport: (request: ReportRequest) => void;
}

const ReportViewerContext = createContext<ReportViewerContextType | undefined>(undefined);

type Viewing =
  | { request: ReportRequest; stage: "loading" }
  | { request: ReportRequest; stage: "ready"; doc: jsPDF; filename: string; url: string }
  | { request: ReportRequest; stage: "error"; error: string };

export function ReportViewerProvider({ children }: { children: ReactNode }) {
  const { members, meetings, reserveTransactions, profitDistributions, refreshData } = useOrganization();
  const { settings } = useSettings();
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [refreshed, setRefreshed] = useState<{ id: number; request: ReportRequest } | null>(null);
  // Identifies the latest request, so a report still building when the viewer is closed or
  // another report is opened is discarded.
  const requestId = useRef(0);

  const openReport = async (request: ReportRequest) => {
    const id = ++requestId.current;
    setViewing({ request, stage: "loading" });
    try {
      await refreshData();
    } catch {
      // Build from the records already loaded.
    }
    if (requestId.current === id) setRefreshed({ id, request });
  };

  // Built here rather than in openReport so it reads the records from a render after the
  // refresh, not the ones captured when the button was clicked.
  useEffect(() => {
    if (!refreshed) return;
    const { id, request } = refreshed;
    setRefreshed(null);
    (async () => {
      try {
        const books = buildBooks({ members, meetings, reserveTransactions, profitDistributions });
        const { doc, filename } = await buildReport(books, request, settings);
        if (requestId.current !== id) return;
        setViewing({ request, stage: "ready", doc, filename, url: URL.createObjectURL(doc.output("blob")) });
      } catch (err: unknown) {
        if (requestId.current !== id) return;
        setViewing({ request, stage: "error", error: err instanceof Error ? err.message : "Failed to generate report" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshed]);

  const url = viewing?.stage === "ready" ? viewing.url : null;
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const close = () => {
    requestId.current++;
    setViewing(null);
  };

  const download = () => {
    if (viewing?.stage !== "ready") return;
    viewing.doc.save(viewing.filename);
    toast.success("Report downloaded", { description: viewing.filename });
  };

  const title = viewing ? reportTitle(viewing.request.kind) : "";

  return (
    <ReportViewerContext.Provider value={{ openReport }}>
      {children}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent className="w-[96vw] max-w-[1200px] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden rounded-sm">
          <div className="flex items-center gap-4 pl-5 pr-14 py-3.5 border-b bg-muted/30 flex-shrink-0">
            <div className="w-9 h-9 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold text-foreground truncate">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate figure">
                {viewing?.stage === "ready" ? viewing.filename : viewing?.stage === "error" ? "Could not generate this report" : "Loading the latest records…"}
              </DialogDescription>
            </div>
            <Button size="sm" className="gap-2 rounded-sm flex-shrink-0" onClick={download} disabled={viewing?.stage !== "ready"}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </Button>
          </div>
          <div className="flex-1 min-h-0 bg-muted/40">
            {viewing?.stage === "ready" ? (
              <iframe title={title} src={viewing.url} className="w-full h-full border-0" />
            ) : viewing?.stage === "error" ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
                <AlertTriangle className="w-6 h-6 text-destructive" />
                <p className="text-sm text-foreground font-medium">{viewing.error}</p>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Preparing report…</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </ReportViewerContext.Provider>
  );
}

export function useReportViewer() {
  const ctx = useContext(ReportViewerContext);
  if (!ctx) throw new Error("useReportViewer must be used within ReportViewerProvider");
  return ctx;
}
