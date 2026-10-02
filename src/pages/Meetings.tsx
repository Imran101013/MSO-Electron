import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Eye, FileText, Clock, Loader2, Trash2, CalendarDays, Share2, MapPin, Pencil } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import ViewReportButton from "@/components/ViewReportButton";
import { thisYearToDate } from "@/utils/accounting";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { useMeetings, DbMeeting, DbUpcomingMeeting } from "@/hooks/useMeetings";
import { useMembers } from "@/hooks/useMembers";
import { attendanceLockedYear, attendanceStatus, saveMeetingAttendance, useAttendance, type AttendanceStatus } from "@/hooks/useAttendance";
import { useContributions } from "@/hooks/useContributions";
import { buildMeetingShareMessage, getMeetingRecord, formatAmount, formatDay, formatTime, reserveLabel, type AmountRow, type MeetingRecord } from "@/utils/meetingShare";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useBooksConfig } from "@/lib/books";
import { emitMeetingSaved } from "@/lib/events";
import { TablePager, usePaged } from "@/components/TablePager";
import { addBankProfit, bankProfitProblem } from "@/hooks/useBankProfits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const meetingSchema = z.object({ date: z.date(), agenda: z.string().min(1, "Agenda is required"), decisions: z.string().optional() });
const upcomingMeetingSchema = z.object({ date: z.date(), time: z.string().min(1, "Time is required"), venue: z.string().min(1, "Venue is required") });
type MeetingFormValues = z.infer<typeof meetingSchema>;
type UpcomingMeetingFormValues = z.infer<typeof upcomingMeetingSchema>;
interface MemberContribution { memberId: string; memberName: string; amount: number; status: AttendanceStatus; }
/** status null: not marked at this meeting (no attendance row). */
interface AttendanceEditRow { memberId: string; name: string; status: AttendanceStatus | null; }
const NO_EDIT_ROWS: AttendanceEditRow[] = [];
const NO_RESERVE: MeetingRecord["reserve"] = [];
const NO_BANK_PROFITS: MeetingRecord["bankProfits"] = [];
type ShareResult = { opened?: "app" | "web"; error?: string };
type WhatsAppBridge = { shareWhatsApp?: (text: string) => Promise<ShareResult> };

export default function Meetings() {
  const { meetings, upcomingMeetings, isLoading, addMeeting, deleteMeeting, addUpcomingMeeting, deleteUpcomingMeeting } = useMeetings();
  const { members, isLoading: membersLoading } = useMembers();
  const { bulkRecordAttendance } = useAttendance();
  const { bulkAddContributions } = useContributions();
  const { settings } = useSettings();
  const { config: books } = useBooksConfig();
  const { isAdmin } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewMeetingId, setViewMeetingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<DbMeeting | null>(null);
  const [upcomingToDelete, setUpcomingToDelete] = useState<DbUpcomingMeeting | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [memberContributions, setMemberContributions] = useState<MemberContribution[]>([]);
  const [viewRecord, setViewRecord] = useState<MeetingRecord | null>(null);
  // Attendance of the meeting being viewed, while it is being edited (null when not editing).
  const [attendanceEdit, setAttendanceEdit] = useState<AttendanceEditRow[] | null>(null);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  // The bank's profit reported at this meeting (optional): the amount, the day the bank credited it
  // (the meeting date unless set) and the year it is for (that day's year unless set).
  const [bankAmount, setBankAmount] = useState("");
  const [bankCreditedOn, setBankCreditedOn] = useState<Date | undefined>(undefined);
  const [bankYear, setBankYear] = useState<number | null>(null);
  const upcomingPaged = usePaged(upcomingMeetings);
  const meetingsPaged = usePaged(meetings);
  const addPaged = usePaged(memberContributions, isAddOpen ? "open" : "closed");
  // Only one meeting's details are open at a time, so their lists are paged here.
  const editPaged = usePaged(attendanceEdit ?? NO_EDIT_ROWS, attendanceEdit ? viewMeetingId : null);
  const reservePaged = usePaged(viewRecord?.reserve ?? NO_RESERVE, viewRecord?.meeting.id ?? null);
  const bankProfitsPaged = usePaged(viewRecord?.bankProfits ?? NO_BANK_PROFITS, viewRecord?.meeting.id ?? null);

  const form = useForm<MeetingFormValues>({ resolver: zodResolver(meetingSchema), defaultValues: { date: undefined, agenda: "", decisions: "" } });
  const scheduleForm = useForm<UpcomingMeetingFormValues>({ resolver: zodResolver(upcomingMeetingSchema), defaultValues: { date: undefined, time: "", venue: "" } });
  const approvedMembers = members;

  const handleOpenAddDialog = () => {
    setMemberContributions(approvedMembers.map(m => ({ memberId: m.id, memberName: m.name, amount: 0, status: "present" })));
    setBankAmount("");
    setBankCreditedOn(undefined);
    setBankYear(null);
    setIsAddOpen(true);
  };

  const updateContribution = (memberId: string, field: 'amount' | 'status', value: number | AttendanceStatus) =>
    setMemberContributions(prev => prev.map(mc => mc.memberId === memberId ? { ...mc, [field]: value } : mc));

  const onSubmit = async (data: MeetingFormValues) => {
    const dateString = format(data.date, "yyyy-MM-dd");
    // The bank profit is checked before anything is saved, so a wrong entry doesn't leave half a meeting.
    const bankValue = bankAmount.trim() === "" ? 0 : Number(bankAmount.replace(/,/g, ""));
    const creditedOn = bankCreditedOn ? format(bankCreditedOn, "yyyy-MM-dd") : dateString;
    const bankInput = { amount: bankValue, creditedOn, profitYear: bankYear ?? Number(creditedOn.slice(0, 4)), meetingDate: dateString };
    if (bankAmount.trim() !== "") {
      const problem = await bankProfitProblem(bankInput, settings.dateFormat);
      if (problem) { toast.error("Bank profit not recorded", { description: problem }); return; }
    }
    setIsSubmitting(true);
    const newMeeting = await addMeeting({ meeting_date: dateString, agenda: data.agenda, decisions: data.decisions });
    if (newMeeting) {
      await bulkRecordAttendance(newMeeting.id, memberContributions.map(mc => ({ memberId: mc.memberId, status: mc.status })));
      await bulkAddContributions(newMeeting.id, memberContributions.map(mc => ({ memberId: mc.memberId, amount: mc.amount })), dateString);
      if (bankValue > 0 && !(await addBankProfit(newMeeting.id, bankInput).catch(() => false))) {
        toast.error("Bank profit not recorded", { description: `The ${bankInput.profitYear} profit has already been distributed.` });
      }
      toast.success(`Meeting added! Total: ${settings.currency} ${memberContributions.reduce((s, c) => s + c.amount, 0).toLocaleString()}`);
      emitMeetingSaved();
    }
    setIsSubmitting(false); setIsAddOpen(false); form.reset(); setMemberContributions([]);
  };

  const onScheduleSubmit = async (data: UpcomingMeetingFormValues) => {
    setIsSubmitting(true);
    await addUpcomingMeeting({ meeting_date: format(data.date, "yyyy-MM-dd"), meeting_time: data.time, venue: data.venue });
    setIsSubmitting(false); setIsScheduleOpen(false); scheduleForm.reset();
  };

  // Same record the WhatsApp message is built from, so the dialog and the message always agree.
  const handleViewMeeting = async (meeting: DbMeeting) => {
    setViewMeetingId(meeting.id);
    setViewRecord(null);
    setAttendanceEdit(null);
    try {
      setViewRecord(await getMeetingRecord(meeting));
    } catch (err) {
      toast.error("Unable to load meeting details", { description: err instanceof Error ? err.message : String(err) });
    }
  };

  // Everyone who had joined by the meeting, with their mark (or none, if they weren't marked).
  const startAttendanceEdit = async (record: MeetingRecord) => {
    const lockedYear = await attendanceLockedYear(record.meeting.id).catch(() => null);
    if (lockedYear !== null) {
      toast.error("Attendance can't be changed", { description: `The ${lockedYear} profit has already been distributed with this meeting's absence charges.` });
      return;
    }
    const marked = new Map(record.attendance.map((a) => [a.memberId, attendanceStatus({ present: a.present, on_leave: a.onLeave })]));
    const roster = [
      ...record.savings.map((s) => ({ memberId: s.memberId, name: s.name })),
      ...record.attendance.filter((a) => !record.savings.some((s) => s.memberId === a.memberId)),
    ];
    setAttendanceEdit(roster.map((r) => ({ memberId: r.memberId, name: r.name, status: marked.get(r.memberId) ?? null })));
  };

  const saveAttendanceEdit = async (meeting: DbMeeting) => {
    if (!attendanceEdit) return;
    setIsSavingAttendance(true);
    try {
      const rows = attendanceEdit.flatMap((r) => (r.status ? [{ memberId: r.memberId, status: r.status }] : []));
      const res = await saveMeetingAttendance(meeting.id, rows);
      if (!res.saved) {
        toast.error("Attendance not saved", { description: `The ${meeting.meeting_date.slice(0, 4)} profit has already been distributed with this meeting's absence charges.` });
        return;
      }
      toast.success("Attendance updated", { description: res.changed ? `${res.changed} member${res.changed === 1 ? "" : "s"} changed.` : "Nothing was changed." });
      setAttendanceEdit(null);
      setViewRecord(await getMeetingRecord(meeting));
      if (res.changed) emitMeetingSaved();
    } catch (err) {
      toast.error("Unable to save attendance", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Opens WhatsApp with the latest meeting's record typed in; the admin chooses who to send it to.
  const shareLatestMeeting = async () => {
    if (meetings.length === 0) {
      toast.error("No meetings", { description: "There is no meeting to share yet." });
      return;
    }
    const api = (window as unknown as { electronAPI?: WhatsAppBridge }).electronAPI;
    if (!api?.shareWhatsApp) {
      toast.error("Unable to open WhatsApp", { description: "Sharing is available in the desktop app." });
      return;
    }
    const latest = meetings.reduce((a, b) => (b.meeting_date > a.meeting_date ? b : a), meetings[0]);
    setIsSharing(true);
    try {
      const res = await api.shareWhatsApp(await buildMeetingShareMessage(latest, settings));
      if (res.error) toast.error("Unable to open WhatsApp", { description: res.error });
      else toast.success(res.opened === "app" ? "WhatsApp opened" : "WhatsApp Web opened", { description: "Choose who to send the meeting record to." });
    } catch (err) {
      toast.error("Unable to prepare the meeting record", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsSharing(false);
    }
  };

  const viewedMeeting = meetings.find(m => m.id === viewMeetingId);

  if (isLoading || membersLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-primary/40 pb-4">
        <div className="flex shrink-0 items-center gap-4">
          <div className="w-11 h-11 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Meeting Register</p>
            <h2 className="text-2xl font-bold text-foreground mt-1">Meeting Records</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Schedule and document meetings</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ViewReportButton request={{ kind: "meetings-register", period: thisYearToDate() }} label="Meetings & Attendance Register" size="default" />
            <Button variant="secondary" className="gap-2" onClick={shareLatestMeeting} disabled={isSharing}>
              {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Share Latest Meeting
            </Button>
            {/* Schedule Dialog */}
            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Clock className="w-4 h-4" /> Schedule Meeting</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">Schedule Upcoming Meeting</DialogTitle>
                    <p className="text-xs text-muted-foreground">Set date, time and venue</p>
                  </div>
                </div>
                <Form {...scheduleForm}>
                  <form onSubmit={scheduleForm.handleSubmit(onScheduleSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                      <FormField control={scheduleForm.control} name="date" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-medium">Meeting Date</FormLabel><FormControl><DatePicker date={field.value} onDateChange={field.onChange} placeholder="Select date" /></FormControl><FormMessage className="text-xs" /></FormItem>
                      )} />
                      <FormField control={scheduleForm.control} name="time" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-medium">Meeting Time</FormLabel><FormControl><Input type="time" {...field} className="h-9" /></FormControl><FormMessage className="text-xs" /></FormItem>
                      )} />
                      <FormField control={scheduleForm.control} name="venue" render={({ field }) => (
                        <FormItem><FormLabel className="text-xs font-medium">Venue</FormLabel><FormControl><Textarea {...field} placeholder="Meeting venue…" className="resize-none" rows={3} /></FormControl><FormMessage className="text-xs" /></FormItem>
                      )} />
                    </div>
                    <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                      <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Scheduling…</> : "Schedule Meeting"}</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Add Meeting Dialog */}
            <Dialog open={isAddOpen} onOpenChange={(o) => { if (o) handleOpenAddDialog(); else setIsAddOpen(false); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm"><Plus className="w-4 h-4" /> Add New Meeting</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">Add New Meeting</DialogTitle>
                    <p className="text-xs text-muted-foreground">Record meeting details and member contributions</p>
                  </div>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                      {/* Meeting Info */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Meeting Information</p>
                        <FormField control={form.control} name="date" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Meeting Date</FormLabel><FormControl><DatePicker date={field.value} onDateChange={field.onChange} placeholder="Select date" disabledThrough={books.cutoverDate} /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="agenda" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Agenda</FormLabel><FormControl><Textarea {...field} placeholder="Meeting agenda…" className="resize-none" rows={2} /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="decisions" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Decisions Made</FormLabel><FormControl><Textarea {...field} placeholder="Decisions made during the meeting…" className="resize-none" rows={2} /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                      </div>
                      {/* Bank profit reported at this meeting (optional) */}
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Profit</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Only if the bank has credited its profit on the account since the last meeting. Leave blank otherwise.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium">Amount ({settings.currency})</p>
                            <Input inputMode="decimal" placeholder="0" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} className="h-9 text-sm" id="bankProfitAmount" />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium">Credited by the bank on</p>
                            <DatePicker
                              date={bankCreditedOn ?? form.watch("date")}
                              onDateChange={(d) => { setBankCreditedOn(d); setBankYear(null); }}
                              placeholder="The meeting date"
                              disabledThrough={books.cutoverDate}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium">Profit for the year</p>
                            {(() => {
                              const credited = bankCreditedOn ?? form.watch("date");
                              const y = credited ? credited.getFullYear() : new Date().getFullYear();
                              return (
                                <Select value={String(bankYear ?? y)} onValueChange={(v) => setBankYear(Number(v))}>
                                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={String(y)}>{y}</SelectItem>
                                    <SelectItem value={String(y - 1)}>{y - 1}</SelectItem>
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      {/* Attendance */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member Attendance & Contributions</p>
                        {memberContributions.length > 0 && (
                          <AttendanceTally
                            statuses={memberContributions.map((mc) => mc.status)}
                            onMarkAll={(s) => setMemberContributions((prev) => prev.map((mc) => ({ ...mc, status: s })))}
                          />
                        )}
                        <div className="grid grid-cols-12 px-3 py-2 bg-muted/50 rounded-sm">
                          <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
                          <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Present</span>
                          <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount ({settings.currency})</span>
                        </div>
                        <p className="px-3 text-xs text-muted-foreground">On leave: not at the meeting but excused (e.g. sent their contribution). No absence charge.</p>
                        <div className="space-y-1.5">
                          {addPaged.rows.map((mc) => (
                            <div key={mc.memberId} className="grid grid-cols-12 items-center px-3 py-2 rounded-sm border border-border/60 hover:bg-muted/20 transition-colors">
                              <div className="col-span-4 flex items-center gap-2 min-w-0">
                                <Avatar className="h-7 w-7"><AvatarFallback className="bg-gradient-primary text-white text-xs">{mc.memberName.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                                <span className="text-sm font-medium truncate">{mc.memberName}</span>
                              </div>
                              <div className="col-span-4">
                                <AttendanceToggle value={mc.status} memberName={mc.memberName} onChange={(s) => updateContribution(mc.memberId, 'status', s)} />
                              </div>
                              <div className="col-span-4">
                                <Input type="number" placeholder="0" value={mc.amount || ""} className="h-8 text-sm"
                                  onChange={(e) => updateContribution(mc.memberId, 'amount', Number(e.target.value) || 0)} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <TablePager paged={addPaged} noun="members" className="px-0 border-t-0" />
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                      <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                      <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Meeting"}</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Upcoming Meetings */}
      {upcomingMeetings.length > 0 && (
        <Card className="shadow-sm rounded-sm border-t-2 border-primary/70">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              Upcoming Meetings
              <span className="figure ml-auto text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-sm font-normal">{upcomingMeetings.length} scheduled</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {upcomingPaged.rows.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between px-5 py-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm border-2 border-primary/30 bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="figure text-sm font-bold text-primary">
                        {format(new Date(meeting.meeting_date), settings.dateFormat)}
                        {meeting.meeting_time && <span className="text-muted-foreground font-normal"> at {formatTime(meeting.meeting_time, settings)}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meeting.venue}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm text-destructive hover:text-destructive" onClick={() => setUpcomingToDelete(meeting)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <TablePager paged={upcomingPaged} noun="scheduled meetings" />
          </CardContent>
        </Card>
      )}

      {/* All Meetings */}
      <Card className="shadow-sm rounded-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-primary" />
              </div>
              All Meetings
            </div>
            {meetings.length > 0 && <span className="figure text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-sm font-normal">{meetings.length} records</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {meetings.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-sm border-2 border-border bg-muted flex items-center justify-center mx-auto mb-3">
                <CalendarDays className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No meetings recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {meetingsPaged.rows.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between px-5 py-2 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-sm border-2 border-primary/30 bg-primary/5 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="figure text-sm font-semibold text-foreground">{format(new Date(meeting.meeting_date), settings.dateFormat)}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{meeting.agenda}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={viewMeetingId === meeting.id} onOpenChange={(o) => { if (o) handleViewMeeting(meeting); else { setViewMeetingId(null); setAttendanceEdit(null); } }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8"><Eye className="w-3.5 h-3.5" /> View</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                          <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Eye className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <DialogTitle className="text-base font-bold text-foreground">Meeting Details</DialogTitle>
                            <p className="figure text-xs text-muted-foreground">
                              {formatDay(meeting.meeting_date, settings)}
                              {viewRecord?.meeting.id === meeting.id && viewRecord.venue && (
                                <span className="inline-flex items-center gap-1 ml-2 font-sans"><MapPin className="w-3 h-3" />{viewRecord.venue}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {viewedMeeting && viewRecord?.meeting.id !== meeting.id && (
                          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                        )}
                        {viewedMeeting && viewRecord?.meeting.id === meeting.id && (
                          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                            <div className="p-4 rounded-sm bg-muted/40 border border-border/60 space-y-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Agenda</p>
                                <p className="text-sm text-foreground">{viewedMeeting.agenda}</p>
                              </div>
                              {viewedMeeting.decisions && (
                                <div className="pt-3 border-t border-border/60">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Decisions</p>
                                  <p className="text-sm text-foreground">{viewedMeeting.decisions}</p>
                                </div>
                              )}
                            </div>
                            {/* Attendance */}
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <SectionLabel>
                                  Attendance{viewRecord.attendance.length ? `: ${viewRecord.presentCount} of ${viewRecord.attendance.length} present` : ""}
                                </SectionLabel>
                                {isAdmin && !attendanceEdit && (
                                  <Button variant="outline" size="sm" className="-mt-1.5 h-7 gap-1.5 px-2.5 text-xs" onClick={() => startAttendanceEdit(viewRecord)}>
                                    <Pencil className="w-3 h-3" /> {viewRecord.attendance.length ? "Edit" : "Record"}
                                  </Button>
                                )}
                              </div>
                              {attendanceEdit ? (
                                <div className="space-y-3">
                                  <AttendanceTally
                                    statuses={attendanceEdit.map((r) => r.status)}
                                    onMarkAll={(s) => setAttendanceEdit((prev) => prev && prev.map((r) => ({ ...r, status: s })))}
                                  />
                                  <div className="rounded-sm border border-border/60 divide-y divide-border/60">
                                    {editPaged.rows.map((r) => (
                                      <div key={r.memberId} className="flex items-center justify-between gap-3 px-4 py-1.5">
                                        <span className="text-sm font-medium truncate">{r.name}</span>
                                        <AttendanceToggle
                                          value={r.status}
                                          memberName={r.name}
                                          onChange={(s) => setAttendanceEdit((prev) => prev && prev.map((x) => (x.memberId === r.memberId ? { ...x, status: s } : x)))}
                                        />
                                      </div>
                                    ))}
                                    <TablePager paged={editPaged} noun="members" />
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    The {viewRecord.meeting.meeting_date.slice(0, 4)} absence charges follow these marks; on leave is excused.
                                    {attendanceEdit.some((r) => !r.status) && " Members left unmarked stay unrecorded for this meeting."}
                                  </p>
                                  <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" disabled={isSavingAttendance} onClick={() => setAttendanceEdit(null)}>Cancel</Button>
                                    <Button size="sm" disabled={isSavingAttendance} onClick={() => saveAttendanceEdit(meeting)}>
                                      {isSavingAttendance ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save attendance"}
                                    </Button>
                                  </div>
                                </div>
                              ) : viewRecord.attendance.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Attendance was not recorded for this meeting.</p>
                              ) : (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="p-4 rounded-sm border-2 border-secondary/40 bg-secondary/10 text-center">
                                      <p className="text-xs font-semibold text-secondary mb-1">Present</p>
                                      <p className="figure text-3xl font-bold text-secondary">{viewRecord.presentCount}</p>
                                    </div>
                                    <div className="p-4 rounded-sm border-2 border-destructive/40 bg-destructive/10 text-center">
                                      <p className="text-xs font-semibold text-destructive mb-1">Absent</p>
                                      <p className="figure text-3xl font-bold text-destructive">{viewRecord.absent.length}</p>
                                    </div>
                                    <div className="p-4 rounded-sm border-2 border-accent/50 bg-accent/10 text-center">
                                      <p className="text-xs font-semibold text-primary mb-1">On leave</p>
                                      <p className="figure text-3xl font-bold text-primary">{viewRecord.onLeave.length}</p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Absent members ({viewRecord.absent.length})</p>
                                    {viewRecord.absent.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">{viewRecord.onLeave.length ? "None." : "None - all members were present."}</p>
                                    ) : (
                                      <NameList names={viewRecord.absent} resetKey={viewRecord.meeting.id} noun="absent members" />
                                    )}
                                  </div>
                                  {viewRecord.onLeave.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground mb-2">On leave ({viewRecord.onLeave.length})</p>
                                      <NameList names={viewRecord.onLeave} resetKey={viewRecord.meeting.id} noun="members on leave" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Savings */}
                            <div>
                              <SectionLabel>Savings</SectionLabel>
                              <AmountTable
                                rows={viewRecord.savings.filter(
                                  (r) => !(Number(r.amount) === 0 && viewRecord.attendance.find((a) => a.memberId === r.memberId)?.present === false)
                                )}
                                totalLabel="Total savings"
                                currency={settings.currency}
                                empty="No savings were collected."
                              />
                            </div>

                            {/* Loans collected */}
                            <div>
                              <SectionLabel>Loans collected</SectionLabel>
                              <AmountTable rows={viewRecord.collected} totalLabel="Total collected" currency={settings.currency} empty="No loan repayments were received." />
                            </div>

                            <div className="flex items-center justify-between px-4 py-3 rounded-sm border-2 border-primary/40 bg-primary/10">
                              <span className="text-sm font-semibold text-foreground">Total collected (savings + loans)</span>
                              <span className="figure text-base font-bold text-primary">{settings.currency} {formatAmount(viewRecord.totals.totalCollected)}</span>
                            </div>

                            {viewRecord.newLoans.length > 0 && (
                              <div>
                                <SectionLabel>New loans issued</SectionLabel>
                                <AmountTable rows={viewRecord.newLoans} totalLabel="Total loans issued" currency={settings.currency} empty="" />
                              </div>
                            )}

                            {viewRecord.reserve.length > 0 && (
                              <div>
                                <SectionLabel>Reserve fund</SectionLabel>
                                <div className="divide-y divide-border/60 rounded-sm border border-border/60 overflow-hidden">
                                  {reservePaged.rows.map((t, i) => (
                                    <div key={reservePaged.offset + i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                      <span className="text-sm">{reserveLabel(t)}</span>
                                      <span className={cn("figure text-sm font-bold whitespace-nowrap", t.transaction_type === "expense" ? "text-destructive" : "text-secondary")}>
                                        {t.transaction_type === "expense" ? "-" : "+"} {settings.currency} {formatAmount(t.amount)}
                                      </span>
                                    </div>
                                  ))}
                                  <TablePager paged={reservePaged} noun="reserve entries" />
                                </div>
                              </div>
                            )}

                            {viewRecord.bankProfits.length > 0 && (
                              <div>
                                <SectionLabel>Bank profit</SectionLabel>
                                <div className="divide-y divide-border/60 rounded-sm border border-border/60 overflow-hidden">
                                  {bankProfitsPaged.rows.map((b, i) => (
                                    <div key={bankProfitsPaged.offset + i} className="flex items-center justify-between gap-4 px-4 py-2.5">
                                      <span className="text-sm">
                                        Bank profit for {b.profit_year}, credited <span className="figure">{formatDay(b.credited_on, settings)}</span>
                                      </span>
                                      <span className="figure text-sm font-bold whitespace-nowrap text-secondary">+ {settings.currency} {formatAmount(b.amount)}</span>
                                    </div>
                                  ))}
                                  <TablePager paged={bankProfitsPaged} noun="bank profits" />
                                </div>
                              </div>
                            )}

                            {viewRecord.next && (
                              <div>
                                <SectionLabel>Next meeting</SectionLabel>
                                <div className="flex items-center gap-3 px-4 py-3 rounded-sm border border-border/60 bg-muted/40">
                                  <CalendarDays className="w-4 h-4 text-primary flex-shrink-0" />
                                  <span className="figure text-sm text-foreground">
                                    {[formatDay(viewRecord.next.meeting_date, settings), formatTime(viewRecord.next.meeting_time, settings), viewRecord.next.venue].filter(Boolean).join(" · ")}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setMeetingToDelete(meeting); setDeleteDialogOpen(true); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <TablePager paged={meetingsPaged} noun="meetings" />
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Meeting</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this meeting? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (meetingToDelete) { await deleteMeeting(meetingToDelete.id); setMeetingToDelete(null); } setDeleteDialogOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!upcomingToDelete} onOpenChange={(o) => { if (!o) setUpcomingToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancel Scheduled Meeting</AlertDialogTitle><AlertDialogDescription>Are you sure you want to remove this scheduled meeting? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { if (upcomingToDelete) { await deleteUpcomingMeeting(upcomingToDelete.id); setUpcomingToDelete(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** How many are marked each way, with buttons to mark everyone present or absent at once. */
function AttendanceTally({ statuses, onMarkAll }: { statuses: (AttendanceStatus | null)[]; onMarkAll: (s: AttendanceStatus) => void }) {
  const count = (s: AttendanceStatus | null) => statuses.filter((x) => x === s).length;
  const unmarked = count(null);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="figure text-xs text-muted-foreground">
        {count("present")} present · {count("absent")} absent · {count("leave")} on leave{unmarked ? ` · ${unmarked} not marked` : ""}
      </p>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Mark all</span>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onMarkAll("present")}>Present</Button>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onMarkAll("absent")}>Absent</Button>
      </div>
    </div>
  );
}

/** Yes / No / On leave for one member; null shows none selected (not marked). */
function AttendanceToggle({ value, onChange, memberName }: { value: AttendanceStatus | null; onChange: (v: AttendanceStatus) => void; memberName: string }) {
  const options: Array<{ value: AttendanceStatus; label: string; on: string }> = [
    { value: "present", label: "Yes", on: "data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground" },
    { value: "absent", label: "No", on: "data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground" },
    { value: "leave", label: "On leave", on: "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground" },
  ];
  return (
    <ToggleGroup
      type="single"
      value={value ?? ""}
      onValueChange={(next) => next && onChange(next as AttendanceStatus)}
      aria-label={`Attendance of ${memberName}`}
      className="w-fit gap-0 rounded-sm border border-input bg-muted/50 p-0.5"
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn("h-7 rounded-[3px] px-2.5 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:font-semibold data-[state=on]:shadow-sm", o.on)}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Numbered list of members (absent, or on leave) at a meeting, paged like the other tables. */
function NameList({ names, resetKey, noun }: { names: string[]; resetKey: string; noun: string }) {
  const paged = usePaged(names, resetKey);
  return (
    <div className="rounded-sm border border-border/60 overflow-hidden">
      <ol className="divide-y divide-border/60">
        {paged.rows.map((name, i) => (
          <li key={`${name}-${paged.offset + i}`} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="figure w-6 text-muted-foreground">{paged.offset + i + 1}.</span>{name}
          </li>
        ))}
      </ol>
      <TablePager paged={paged} noun={noun} />
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{children}</p>;
}

/** Member / amount list with a total row, matching the lists in the WhatsApp message. */
function AmountTable({ rows, totalLabel, currency, empty }: {
  rows: AmountRow[];
  totalLabel: string;
  currency: string;
  empty: string;
}) {
  const paged = usePaged(rows);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  // The total is for every row, not just the page shown.
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  return (
    <div className="divide-y divide-border/60 rounded-sm border border-border/60 overflow-hidden">
      <div className="grid grid-cols-12 px-4 py-2 bg-muted/50">
        <span className="col-span-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
        <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
      </div>
      {paged.rows.map((r, i) => {
        return (
          <div key={`${r.memberId}-${i}`} className="grid grid-cols-12 items-center px-4 py-2.5 hover:bg-muted/30 transition-colors">
            <span className="col-span-8 text-sm font-medium">{r.name}</span>
            <span className={cn("figure text-sm text-right col-span-4", Number(r.amount) > 0 ? "font-bold text-foreground" : "text-muted-foreground")}>
              {formatAmount(r.amount)}
            </span>
          </div>
        );
      })}
      <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/40">
        <span className="col-span-8 text-xs font-semibold text-muted-foreground">{totalLabel}</span>
        <span className="figure col-span-4 text-sm font-bold text-foreground text-right">{currency} {formatAmount(total)}</span>
      </div>
      <TablePager paged={paged} noun="members" />
    </div>
  );
}
