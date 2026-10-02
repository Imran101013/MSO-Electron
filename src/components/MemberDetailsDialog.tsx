import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Cake, CalendarDays, Hash, Loader2, Mail, MapPin, MessageCircle, Phone, Upload, User } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { dbQuery } from "@/lib/db";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/hooks/useLoans";
import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/hooks/useAttendance";
import ViewReportButton from "@/components/ViewReportButton";
import { TablePager, usePaged } from "@/components/TablePager";
import { supabase } from "@/integrations/supabase/client";
import { ageFrom, durationSince, formatMemberSummary, getMemberRecord, type LoanState, type MemberRecord } from "@/utils/memberRecord";

type ShareResult = { opened?: "app" | "web"; error?: string };
type Bridge = { shareWhatsApp?: (text: string, phone?: string) => Promise<ShareResult> };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface MemberDetailsDialogProps {
  memberId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the member record changes (e.g. a new photo) so the caller can refresh its list. */
  onChanged?: () => void;
}

/** Member Details: profile, account summary, savings account (with meeting attendance) and loans. */
const NO_SAVINGS: MemberRecord["savings"] = [];
const NO_LOANS: MemberRecord["loans"] = [];

export default function MemberDetailsDialog({ memberId, open, onOpenChange, onChanged }: MemberDetailsDialogProps) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const [record, setRecord] = useState<MemberRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Savings history, newest first, paged like the app's other tables.
  const savingsPaged = usePaged(record?.savings ?? NO_SAVINGS, memberId ?? null);
  const loansPaged = usePaged(record?.loans ?? NO_LOANS, memberId ?? null);

  const load = async (id: string) => {
    setLoadError(null);
    try {
      setRecord(await getMemberRecord(id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    if (open && memberId) {
      setRecord(null);
      load(memberId);
    }
  }, [open, memberId]);

  const cur = settings.currency || "PKR";
  const amount = (v: number) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const money = (v: number) => `${cur} ${amount(v)}`;
  const day = (key: string | null) => (key ? format(parseLocalDate(key.slice(0, 10)), settings.dateFormat || "dd/MM/yyyy") : "-");
  const ready = record && record.member.id === memberId;

  const updatePhoto = () => {
    if (!record) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/gif";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return toast.error("Invalid file", { description: "Please choose a JPG, PNG or GIF image." });
      if (file.size > MAX_IMAGE_BYTES) return toast.error("File too large", { description: "Profile pictures must be 5 MB or smaller." });
      setUploading(true);
      try {
        const filePath = `members/${Date.now()}.${file.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("profile-pictures").upload(filePath, file);
        if (error) throw new Error("The photo could not be uploaded. Check the internet connection and try again.");
        const { data } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);
        // Only the photo changes; the other member fields are left as they are.
        await dbQuery("UPDATE public.members SET profile_picture = $1 WHERE id = $2", [data.publicUrl, record.member.id]);
        toast.success("Photo updated");
        await load(record.member.id);
        onChanged?.();
      } catch (err) {
        toast.error("Unable to update photo", { description: err instanceof Error ? err.message : String(err) });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const sendSummary = async () => {
    if (!record) return;
    if (!record.member.phone) return toast.error("No phone number", { description: "Add a phone number to this member to send a WhatsApp summary." });
    const api = (window as unknown as { electronAPI?: Bridge }).electronAPI;
    if (!api?.shareWhatsApp) return toast.error("Unable to open WhatsApp", { description: "Sharing is available in the desktop app." });
    setSharing(true);
    try {
      const res = await api.shareWhatsApp(formatMemberSummary(record, settings), record.member.phone);
      if (res.error) toast.error("Unable to open WhatsApp", { description: res.error });
      else toast.success(res.opened === "app" ? "WhatsApp opened" : "WhatsApp Web opened", { description: `Summary ready to send to ${record.member.name}.` });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-sm border-t-2 border-t-accent">
        {!ready ? (
          <>
            <DialogTitle className="sr-only">Member Details</DialogTitle>
            <DialogDescription className="sr-only">Loading member details</DialogDescription>
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              {loadError ? <span className="text-destructive">{loadError}</span> : <Loader2 className="w-6 h-6 animate-spin text-primary" />}
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-5 pb-4 pr-12 border-b bg-muted/30">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 rounded-sm border-2 border-primary/50 flex-shrink-0">
                  <AvatarImage src={record.member.profile_picture || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-sm bg-primary/10 text-primary text-xl font-bold">
                    {record.member.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Member · {record.memberNo}</p>
                  <DialogTitle className="text-xl font-bold text-foreground leading-tight mt-1 truncate">{record.member.name}</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                    {record.member.father_name ? `Father: ${record.member.father_name} · ` : ""}Member since {day(record.member.join_date)}
                  </DialogDescription>
                </div>
                {isAdmin && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <ViewReportButton request={{ kind: "member-statement", memberId: record.member.id }} label="Member Account Statement" className="h-8 justify-start" />
                    <Button variant="outline" size="sm" className="gap-2 h-8 rounded-sm justify-start" onClick={sendSummary} disabled={sharing}>
                      {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />} WhatsApp summary
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 h-8 rounded-sm justify-start" onClick={updatePhoto} disabled={uploading}>
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Update photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Account summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryTile
                  label="Savings balance"
                  // unit={cur}
                  value={amount(record.savingsBalance)}
                  // sub={record.profitTotal > 0 ? `Contributions ${amount(record.contributionsTotal)} + profit ${amount(record.profitTotal)}` : "Total contributions"}
                  // tone="good"
                />
                <SummaryTile
                  label="Loan outstanding"
                  // unit={cur}
                  value={amount(record.loanOutstanding)}
                  sub={loanStateNote(record)}
                  tone={record.loans.some((l) => l.state === "Overdue" || l.state === "Defaulted") ? "bad" : undefined}
                />
                <SummaryTile
                  label="Attendance"
                  value={record.recordedMeetings ? `${Math.round((record.attended / record.recordedMeetings) * 100)}%` : "-"}
                  sub={
                    record.recordedMeetings
                      ? `${record.attended} of ${record.recordedMeetings} meetings${record.onLeaveMeetings ? ` · ${record.onLeaveMeetings} on leave` : ""}`
                      : record.onLeaveMeetings
                        ? `${record.onLeaveMeetings} on leave`
                        : "No attendance recorded"
                  }
                />
                <SummaryTile
                  label="Last dividend"
                  // unit={record.lastDividend ? cur : undefined}
                  value={record.lastDividend ? amount(record.lastDividend.amount) : "-"}
                  sub={
                    !record.lastDividend
                      ? "No profit shared yet"
                      : [
                          record.lastDividend.year ? `For ${record.lastDividend.year}` : `On ${day(record.lastDividend.date)}`,
                          record.lastDividend.ratio !== null ? `${(record.lastDividend.ratio * 100).toFixed(2)}% share` : null,
                        ].filter(Boolean).join(" · ")
                  }
                />
              </div>

              {/* Personal details */}
              <div>
                <SectionLabel>Personal details</SectionLabel>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-sm border border-border/60 p-4">
                  <Detail icon={Hash} label="Member no." value={record.memberNo} mono />
                  <Detail icon={User} label="Father's name" value={record.member.father_name || "-"} />
                  <Detail
                    icon={Cake}
                    label="Date of birth"
                    value={record.member.dob ? `${day(record.member.dob)} (${ageFrom(record.member.dob)} yrs)` : "-"}
                    mono
                  />
                  <Detail icon={CalendarDays} label="Member since" value={`${day(record.member.join_date)} · ${durationSince(record.member.join_date)}`} mono />
                  <Detail icon={Phone} label="Phone" value={record.member.phone || "-"} mono />
                  <Detail icon={Mail} label="Email" value={record.member.email || "-"} />
                  <Detail icon={MapPin} label="Address" value={record.member.address || "-"} wide />
                </dl>
              </div>

              {/* Records */}
              <Tabs defaultValue="savings">
                <TabsList className="grid w-full grid-cols-2 rounded-sm">
                  <TabsTrigger value="savings" className="rounded-sm">Savings account ({record.savings.length})</TabsTrigger>
                  <TabsTrigger value="loans" className="rounded-sm">Loans ({record.loans.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="savings" className="mt-3">
                  {record.savings.length === 0 ? (
                    <Empty>No contributions recorded yet.</Empty>
                  ) : (
                    <div className="rounded-sm border border-border/60 overflow-hidden">
                      <div className="grid grid-cols-12 px-3 py-2 bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="col-span-3">Date</span>
                        <span className="col-span-3">Particulars</span>
                        <span className="col-span-2">Attendance</span>
                        <span className="col-span-2 text-right">Amount</span>
                        <span className="col-span-2 text-right">Balance</span>
                      </div>
                      <div className="divide-y divide-border/60">
                        {savingsPaged.rows.map((s, i) => (
                          <div key={i} className="grid grid-cols-12 items-center px-3 py-2 text-sm hover:bg-muted/30 transition-colors">
                            <span className="col-span-3 figure">{day(s.date)}</span>
                            <span className={cn("col-span-3", s.kind !== "contribution" && "text-primary font-medium")}>{s.kind === "profit" ? "Profit share" : s.kind === "opening" ? "Brought forward" : "Contribution"}</span>
                            <span className="col-span-2">
                              {s.attendance === null ? <span className="text-xs text-muted-foreground">-</span> : <PresenceBadge status={s.attendance} />}
                            </span>
                            <span className="col-span-2 figure text-right font-semibold">{amount(s.amount)}</span>
                            <span className="col-span-2 figure text-right text-muted-foreground">{amount(s.balance)}</span>
                          </div>
                        ))}
                      </div>
                      <TablePager paged={savingsPaged} noun="entries" />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="loans" className="mt-3 space-y-3">
                  {record.loans.length === 0 ? (
                    <Empty>No loans taken.</Empty>
                  ) : (
                    loansPaged.rows.map((l) => {
                      const owedInAll = l.totalPayable + l.bankCharge + l.penaltyTotal;
                      const progress = owedInAll > 0 ? Math.min(100, (l.repaid / owedInAll) * 100) : 0;
                      return (
                        <div key={l.id} className="rounded-sm border border-border/60 overflow-hidden">
                          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40">
                            <div>
                              <p className="text-sm font-semibold text-foreground">Loan of {money(l.principal)}</p>
                              <p className="figure text-xs text-muted-foreground">
                                Issued {day(l.date)} · due by {day(l.dueDate)} · {l.interestRate}% interest
                              </p>
                            </div>
                            <StateBadge state={l.state} />
                          </div>
                          <div className="px-4 py-3 space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <Figure label={l.penaltyTotal > 0 || l.bankCharge > 0 ? "Owed in all" : "Total payable"} value={money(owedInAll)} />
                              <Figure label="Repaid" value={money(l.repaid)} tone="good" />
                              <Figure label="Remaining" value={money(l.remaining)} tone={l.remaining > 0 ? "bad" : undefined} />
                            </div>
                            <div>
                              <div className="h-1.5 w-full rounded-sm bg-muted overflow-hidden">
                                <div className="h-full bg-secondary" style={{ width: `${progress}%` }} />
                              </div>
                              <p className="figure text-[11px] text-muted-foreground mt-1">{progress.toFixed(0)}% repaid</p>
                            </div>
                            {l.state === "Overdue" && (
                              <p className="text-xs font-semibold text-destructive">
                                Overdue: {money(l.arrears)} · {l.daysOverdue} day{l.daysOverdue === 1 ? "" : "s"} past the due date
                                {l.penaltyTotal > 0 && <> · incl. {money(l.penaltyTotal)} late penalty</>}
                              </p>
                            )}
                            {l.timeLeft && (
                              <p className="figure text-xs text-foreground">Due by {day(l.dueDate)} · {l.timeLeft} · {money(l.remaining)} to repay, in any amounts</p>
                            )}
                            {/* How the balance is made up. Interest and penalties are part of it, not an
                                extra amount, and are collected together when the loan is repaid in full. */}
                            <div className="rounded-sm border border-border/60">
                              <p className="text-xs font-semibold text-muted-foreground px-3 pt-2">How the balance is made up</p>
                              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-3 py-2 text-xs">
                                <span className="text-foreground">Amount lent</span>
                                <span className="figure text-right">{amount(l.principal)}</span>
                                <span className="text-foreground">
                                  <span className="text-muted-foreground mr-1">+</span>Interest ({l.interestRate}% flat)
                                </span>
                                <span className="figure text-right">{amount(l.income.interest)}</span>
                                {l.bankCharge > 0 && (
                                  <>
                                    <span className="text-foreground"><span className="text-muted-foreground mr-1">+</span>Bank charge on the withdrawal</span>
                                    <span className="figure text-right">{amount(l.bankCharge)}</span>
                                  </>
                                )}
                                {l.income.penaltiesCharged > 0 && (
                                  <>
                                    <span className="text-foreground"><span className="text-muted-foreground mr-1">+</span>Late penalties</span>
                                    <span className="figure text-right">{amount(l.income.penaltiesCharged)}</span>
                                  </>
                                )}
                                <span className="text-foreground"><span className="text-muted-foreground mr-1">−</span>Repaid</span>
                                <span className="figure text-right text-secondary">{amount(l.repaid)}</span>
                                <span className="font-semibold text-foreground border-t border-border/60 pt-1"><span className="text-muted-foreground mr-1">=</span>Outstanding</span>
                                <span className={cn("figure text-right font-semibold border-t border-border/60 pt-1", l.remaining > 0 && "text-destructive")}>{amount(l.remaining)}</span>
                              </div>
                              {(l.income.interest > 0 || l.income.penaltiesCharged > 0) && (
                                <p className="figure text-[11px] text-muted-foreground px-3 pb-2">
                                  {l.income.receivedOn
                                    ? `Interest and penalties collected on ${day(l.income.receivedOn)}, when the loan was repaid in full.`
                                    : "Interest and penalties are collected when the loan is repaid in full."}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Repayments</p>
                              {l.repayments.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No repayments yet.</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {l.repayments.map((p, i) => (
                                    <span key={i} className="figure text-xs px-2 py-1 rounded-sm border border-border/60 bg-muted/40">
                                      {day(p.date)} · {amount(p.amount)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <TablePager paged={loansPaged} noun="loans" className="rounded-sm border border-border/60" />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{children}</p>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground text-center py-6 rounded-sm border border-dashed border-border/60">{children}</p>;
}

function SummaryTile({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-sm border border-border/60 border-t-2 border-t-accent bg-card px-3 py-3 min-w-0">
      <p className="tracked-label text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className={cn("figure text-lg font-bold mt-1 leading-tight break-all", tone === "good" ? "text-secondary" : tone === "bad" ? "text-destructive" : "text-foreground")}>
        {unit && <span className="text-[11px] font-semibold text-muted-foreground mr-1">{unit}</span>}
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
    </div>
  );
}

function Detail({ icon: Icon, label, value, mono, wide }: { icon: ElementType; label: string; value: string; mono?: boolean; wide?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 min-w-0", wide && "sm:col-span-2")}>
      <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className={cn("text-sm font-medium text-foreground break-words", mono && "figure")}>{value}</dd>
      </div>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("figure text-sm font-bold", tone === "good" ? "text-secondary" : tone === "bad" ? "text-destructive" : "text-foreground")}>{value}</p>
    </div>
  );
}

function PresenceBadge({ status }: { status: AttendanceStatus }) {
  const variant = status === "present" ? "secondary" : status === "leave" ? "outline" : "destructive";
  return <Badge variant={variant} className="text-[10px] whitespace-nowrap">{ATTENDANCE_LABEL[status]}</Badge>;
}

function StateBadge({ state }: { state: LoanState }) {
  const variant = state === "Paid" ? "secondary" : state === "Active" ? "outline" : "destructive";
  return <Badge variant={variant} className="text-[10px] flex-shrink-0">{state}</Badge>;
}

/** Under the Loan outstanding figure: open loans, and the worst state among them (defaulted, overdue). */
function loanStateNote(record: MemberRecord): string {
  if (!record.openLoans) return "No outstanding loans";
  const open = `${record.openLoans} open loan${record.openLoans === 1 ? "" : "s"}`;
  const worst = record.loans.find((l) => l.state === "Defaulted") ?? record.loans.find((l) => l.state === "Overdue");
  return worst ? `${open} · ${worst.state.toLowerCase()}` : open;
}
