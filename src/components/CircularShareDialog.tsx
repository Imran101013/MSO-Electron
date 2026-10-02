import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Copy, Loader2, MessageCircle, Megaphone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/contexts/SettingsContext";
import { dbQuery } from "@/lib/db";
import { formatTime } from "@/lib/utils";
import { fillCircular, unfilledFields, type CircularMeeting } from "@/lib/circular";
import { format } from "date-fns";

type ShareResult = { opened?: "app" | "web"; error?: string };
type Bridge = { shareWhatsApp?: (text: string) => Promise<ShareResult> };
type Scheduled = CircularMeeting & { id: string };

const dayOf = (key: string) => { const [y, m, d] = key.slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };

/**
 * The circular for a scheduled meeting, filled in from the format in Settings and editable here
 * before it goes to WhatsApp. Edits made here are for this one message; the format stays as saved.
 */
export default function CircularShareDialog({ open, onOpenChange, template }: { open: boolean; onOpenChange: (open: boolean) => void; template: string }) {
  const { settings } = useSettings();
  const [scheduled, setScheduled] = useState<Scheduled[] | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setScheduled(null);
    dbQuery<Scheduled>(
      "SELECT id, meeting_date::text AS meeting_date, meeting_time::text AS meeting_time, venue FROM public.upcoming_meetings WHERE meeting_date >= CURRENT_DATE ORDER BY meeting_date, meeting_time",
    )
      .catch(() => [] as Scheduled[])
      .then((rows) => {
        if (!active) return;
        setScheduled(rows);
        setMeetingId(rows[0]?.id ?? null);
        setText(fillCircular(template, rows[0] ?? null, settings.dateFormat, settings.timeFormat));
      });
    return () => { active = false; };
    // Filled once each time the dialog opens; the edits that follow are the user's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickMeeting = (id: string) => {
    setMeetingId(id);
    setText(fillCircular(template, scheduled?.find((m) => m.id === id) ?? null, settings.dateFormat, settings.timeFormat));
  };

  const meetingLabel = (m: Scheduled) =>
    [format(dayOf(m.meeting_date), settings.dateFormat), formatTime(m.meeting_time, settings.timeFormat), m.venue].filter(Boolean).join(" · ");

  const missing = unfilledFields(text);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Circular copied", { description: "Paste it into the WhatsApp group with Ctrl+V." });
    } catch {
      toast.error("Unable to copy the circular");
    }
  };

  const share = async () => {
    const api = (window as unknown as { electronAPI?: Bridge }).electronAPI;
    if (!api?.shareWhatsApp) {
      toast.error("Unable to open WhatsApp", { description: "Sharing is available in the desktop app." });
      return;
    }
    setSharing(true);
    try {
      const res = await api.shareWhatsApp(text);
      if (res.error) toast.error("Unable to open WhatsApp", { description: res.error });
      else {
        toast.success(res.opened === "app" ? "WhatsApp opened" : "WhatsApp Web opened", { description: "Choose the group; the circular is typed in, ready to send." });
        onOpenChange(false);
      }
    } catch (err) {
      toast.error("Unable to open WhatsApp", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-sm">
        <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
          <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground">Share the meeting circular</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Check and change it as needed; the format in Settings stays as saved.</DialogDescription>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {scheduled === null ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">For the meeting</Label>
                {scheduled.length > 0 ? (
                  <Select value={meetingId ?? undefined} onValueChange={pickMeeting}>
                    <SelectTrigger className="h-9 rounded-sm figure"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {scheduled.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="figure">{meetingLabel(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm text-muted-foreground">No meeting is scheduled. Schedule one on the Meetings page to fill in its date and day, or type them below.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="circularText" className="text-xs font-medium">Circular</Label>
                <Textarea
                  id="circularText"
                  dir="rtl"
                  lang="ur"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={12}
                  className="urdu text-base leading-loose rounded-sm resize-y"
                />
              </div>
              {missing.length > 0 && (
                <p className="flex items-start gap-2 rounded-sm border border-accent/60 bg-accent/10 px-3 py-2 text-xs text-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>
                    Still to fill in: {missing.map((f) => `${f.label} (${f.token})`).join(", ")}. Replace {missing.length === 1 ? "it" : "them"} before sending.
                  </span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-wrap justify-end gap-3 px-6 py-4 border-t bg-muted/20">
          <Button type="button" variant="outline" size="sm" className="gap-2 rounded-sm" onClick={copy} disabled={scheduled === null || !text.trim()}>
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
          <Button type="button" size="sm" className="gap-2 rounded-sm" onClick={share} disabled={scheduled === null || sharing || !text.trim()}>
            {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} Share on WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
