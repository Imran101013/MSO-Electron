import logoUrl from "@/assets/mso-logo.png";
import { cn } from "@/lib/utils";

/** The official MSO seal — the same image used on the PDF letterhead and the app icon. */
export default function MsoMark({ className }: { className?: string }) {
  return <img src={logoUrl} alt="MSO" draggable={false} className={cn("select-none object-contain", className)} />;
}
