import { FileText } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useReportViewer } from "@/contexts/ReportViewerContext";
import { todayKey } from "@/utils/accounting";
import type { ReportRequest } from "@/utils/pdfReports";
import { cn } from "@/lib/utils";

interface ViewReportButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Defaults to since inception, as at today; the Reports page offers other periods. */
  request: Omit<ReportRequest, "period"> & Partial<Pick<ReportRequest, "period">>;
  label: string;
}

/** Opens a PDF report in the in-app viewer, where it can be downloaded. */
export default function ViewReportButton({ request, label, variant = "outline", size = "sm", className, ...props }: ViewReportButtonProps) {
  const { openReport } = useReportViewer();
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("gap-2 rounded-sm", className)}
      onClick={() => openReport({ period: { from: null, to: todayKey() }, ...request })}
      {...props}
    >
      <FileText className="w-3.5 h-3.5" /> {label}
    </Button>
  );
}
