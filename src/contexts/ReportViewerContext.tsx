import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { jsPDF } from "jspdf";
import { AlertTriangle, ChevronDown, Download, FileText, Images, Loader2, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { orgName } from "@/utils/whatsappFormat";
import { buildBooks } from "@/utils/accounting";
import { buildReport, reportTitle, type ReportRequest } from "@/utils/pdfReports";
import { cutoverMessage, fetchBooksConfig, firstBookDay } from "@/lib/books";

interface ReportViewerContextType {
  /** Reloads the records, builds the report and shows it, with a Download button. */
  openReport: (request: ReportRequest) => void;
}

const ReportViewerContext = createContext<ReportViewerContextType | undefined>(undefined);

type ShareFileResult = { opened?: "app" | "web"; copied?: boolean; file?: string; count?: number; error?: string };
type ShareBridge = {
  shareFileWhatsApp?: (filename: string, data: ArrayBuffer, text: string, phone?: string | null) => Promise<ShareFileResult>;
  shareFilesWhatsApp?: (files: { name: string; data: ArrayBuffer }[], text: string, phone?: string | null) => Promise<ShareFileResult>;
  showSharedFile?: (file: string) => Promise<{ error?: string }>;
};
/** As pictures, one per page (they read in the chat), or as the PDF file (for printing or keeping). */
type ShareFormat = "pictures" | "pdf";
const MAX_PICTURES = 100; // WhatsApp sends at most 100 media in one go

type Viewing =
  | { request: ReportRequest; stage: "loading" }
  | { request: ReportRequest; stage: "ready"; doc: jsPDF; filename: string; subtitle: string; phone: string | null; url: string }
  | { request: ReportRequest; stage: "error"; error: string };

export function ReportViewerProvider({ children }: { children: ReactNode }) {
  const { members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit, refreshData } = useOrganization();
  const { settings } = useSettings();
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [sharing, setSharing] = useState(false);
  const [refreshed, setRefreshed] = useState<{ id: number; request: ReportRequest } | null>(null);
  // Identifies the latest request, so a report still building when the viewer is closed or
  // another report is opened is discarded.
  const requestId = useRef(0);

  const openReport = async (asked: ReportRequest) => {
    const id = ++requestId.current;
    // Records up to the cut-over are in the paper registers, so a report's period starts the day
    // after it; a report as at the cut-over date itself shows the opening balances.
    let request = asked;
    try {
      const { cutoverDate } = await fetchBooksConfig();
      if (cutoverDate) {
        const p = asked.period;
        if (p.to < cutoverDate) {
          setViewing({ request: asked, stage: "error", error: cutoverMessage(cutoverDate, settings.dateFormat).replace("Choose a date", "Choose a report date") });
          return;
        }
        const first = firstBookDay(cutoverDate);
        const from = p.to === cutoverDate ? null : !p.from || p.from < first ? first : p.from;
        request = { ...asked, period: { from, to: p.to } };
      }
    } catch {
      // No cut-over could be read: report on everything recorded.
    }
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
        const books = buildBooks({ members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit });
        const { doc, filename, subtitle } = await buildReport(books, request, settings);
        if (requestId.current !== id) return;
        // A member's or a loan's statement is shared straight to that member's chat.
        const memberId = request.kind === "member-statement" ? request.memberId : request.kind === "loan-statement" && request.loanId ? books.loanById.get(request.loanId)?.memberId : undefined;
        const phone = (memberId && books.memberById.get(memberId)?.phone) || null;
        setViewing({ request, stage: "ready", doc, filename, subtitle, phone, url: URL.createObjectURL(doc.output("blob")) });
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

  const share = async (format: ShareFormat) => {
    if (viewing?.stage !== "ready") return;
    const api = (window as unknown as { electronAPI?: ShareBridge }).electronAPI;
    if (!api?.shareFileWhatsApp || !api.shareFilesWhatsApp) {
      toast.error("Unable to open WhatsApp", { description: "Sharing is available in the desktop app." });
      return;
    }
    setSharing(true);
    try {
      const pdf = viewing.doc.output("arraybuffer");
      let files: { name: string; data: ArrayBuffer }[];
      if (format === "pictures") {
        const { pdfToPngPages } = await import("@/utils/pdfImages");
        const pages = await pdfToPngPages(pdf);
        if (pages.length > MAX_PICTURES) {
          toast.error("Too many pages for pictures", { description: `This report has ${pages.length} pages; WhatsApp sends at most ${MAX_PICTURES} pictures at once. Share it as a PDF, or choose a shorter period.` });
          return;
        }
        const stem = viewing.filename.replace(/\.pdf$/i, "");
        const digits = String(pages.length).length;
        files = pages.map((data, i) => ({ name: `${stem}_page-${String(i + 1).padStart(digits, "0")}.png`, data }));
      } else {
        files = [{ name: viewing.filename, data: pdf }];
      }
      // Plain text: the asterisks of WhatsApp's bold show as typed until the message is sent.
      // The organisation, the report, then its subtitle (period, member or loan), as on the letterhead.
      const pagesNote = format === "pictures" ? `  |  ${files.length} page${files.length === 1 ? "" : "s"}` : "";
      const caption = `${orgName(settings)} (MSO)\n${title}\n${viewing.subtitle}${pagesNote}`;
      const res = await api.shareFilesWhatsApp(files, caption, viewing.phone);
      if (res.error) {
        toast.error("Unable to share the report", { description: res.error });
        return;
      }
      const what = format === "pictures" ? `the ${files.length === 1 ? "picture" : `${files.length} pictures`}` : "the PDF";
      const showFile = () => { if (res.file) api.showSharedFile?.(res.file); };
      if (res.copied) {
        toast.success(format === "pictures" ? `${files.length} page${files.length === 1 ? "" : "s"} copied as pictures: paste in WhatsApp` : "Report copied: paste it in WhatsApp", {
          description: `${viewing.phone ? "In the member's chat" : "Choose the chat, then"} press Ctrl+V to attach ${what}, or drag ${files.length === 1 ? "it" : "them"} in from Show file.`,
          action: { label: "Show file", onClick: showFile },
          duration: 15000,
        });
      } else {
        showFile();
        toast.success("WhatsApp opened", { description: `Drag ${what} from the folder that opened into the chat.`, duration: 15000 });
      }
    } catch (err) {
      toast.error("Unable to share the report", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSharing(false);
    }
  };

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 rounded-sm flex-shrink-0" disabled={viewing?.stage !== "ready" || sharing}>
                  {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                  {sharing ? "Preparing…" : "Share on WhatsApp"}
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-sm">
                <DropdownMenuItem className="flex items-start gap-3 rounded-sm py-2" onSelect={() => share("pictures")}>
                  <Images className="w-4 h-4 mt-0.5 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">As pictures</span>
                    <span className="block text-xs text-muted-foreground">One per page, read right in the chat</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-start gap-3 rounded-sm py-2" onSelect={() => share("pdf")}>
                  <FileText className="w-4 h-4 mt-0.5 text-primary" />
                  <span>
                    <span className="block text-sm font-medium">As a PDF file</span>
                    <span className="block text-xs text-muted-foreground">For printing or keeping</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
