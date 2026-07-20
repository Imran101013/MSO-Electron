import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Eye, FileText, Clock, Loader2, Trash2, CalendarDays, Users } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { formatTimeTo12Hour } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { useMeetings, DbMeeting, DbUpcomingMeeting } from "@/hooks/useMeetings";
import { useMembers } from "@/hooks/useMembers";
import { useAttendance } from "@/hooks/useAttendance";
import { useContributions } from "@/hooks/useContributions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { emitMeetingSaved } from "@/lib/events";

const meetingSchema = z.object({ date: z.date(), agenda: z.string().min(1, "Agenda is required"), decisions: z.string().optional() });
const upcomingMeetingSchema = z.object({ date: z.date(), time: z.string().min(1, "Time is required"), venue: z.string().min(1, "Venue is required") });
type MeetingFormValues = z.infer<typeof meetingSchema>;
type UpcomingMeetingFormValues = z.infer<typeof upcomingMeetingSchema>;
interface MemberContribution { memberId: string; memberName: string; amount: number; present: boolean; }

export default function Meetings() {
  const { meetings, upcomingMeetings, isLoading, addMeeting, deleteMeeting, addUpcomingMeeting, deleteUpcomingMeeting } = useMeetings();
  const { members, isLoading: membersLoading } = useMembers();
  const { bulkRecordAttendance, getAttendanceForMeeting } = useAttendance();
  const { bulkAddContributions, getContributionsByMeeting } = useContributions();
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewMeetingId, setViewMeetingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<DbMeeting | null>(null);
  const [upcomingToDelete, setUpcomingToDelete] = useState<DbUpcomingMeeting | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberContributions, setMemberContributions] = useState<MemberContribution[]>([]);
  const [viewMeetingData, setViewMeetingData] = useState<{ attendance: any[]; contributions: any[] }>({ attendance: [], contributions: [] });

  const form = useForm<MeetingFormValues>({ resolver: zodResolver(meetingSchema), defaultValues: { date: undefined, agenda: "", decisions: "" } });
  const scheduleForm = useForm<UpcomingMeetingFormValues>({ resolver: zodResolver(upcomingMeetingSchema), defaultValues: { date: undefined, time: "", venue: "" } });
  const approvedMembers = members.filter(m => m.is_approved);

  const handleOpenAddDialog = () => {
    setMemberContributions(approvedMembers.map(m => ({ memberId: m.id, memberName: m.name, amount: 0, present: false })));
    setIsAddOpen(true);
  };

  const updateContribution = (memberId: string, field: 'amount' | 'present', value: number | boolean) =>
    setMemberContributions(prev => prev.map(mc => mc.memberId === memberId ? { ...mc, [field]: value } : mc));

  const onSubmit = async (data: MeetingFormValues) => {
    setIsSubmitting(true);
    const dateString = format(data.date, "yyyy-MM-dd");
    const newMeeting = await addMeeting({ meeting_date: dateString, agenda: data.agenda, decisions: data.decisions });
    if (newMeeting) {
      await bulkRecordAttendance(newMeeting.id, memberContributions.map(mc => ({ memberId: mc.memberId, present: mc.present })));
      await bulkAddContributions(newMeeting.id, memberContributions.map(mc => ({ memberId: mc.memberId, amount: mc.amount })), dateString);
      toast.success(`Meeting added! Total: PKR ${memberContributions.reduce((s, c) => s + c.amount, 0).toLocaleString()}`);
      emitMeetingSaved();
    }
    setIsSubmitting(false); setIsAddOpen(false); form.reset(); setMemberContributions([]);
  };

  const onScheduleSubmit = async (data: UpcomingMeetingFormValues) => {
    setIsSubmitting(true);
    await addUpcomingMeeting({ meeting_date: format(data.date, "yyyy-MM-dd"), meeting_time: data.time, venue: data.venue });
    setIsSubmitting(false); setIsScheduleOpen(false); scheduleForm.reset();
  };

  const handleViewMeeting = async (meeting: DbMeeting) => {
    setViewMeetingId(meeting.id);
    const [attendance, contributions] = await Promise.all([getAttendanceForMeeting(meeting.id), getContributionsByMeeting(meeting.id)]);
    setViewMeetingData({ attendance, contributions });
  };

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const shareLatestMeetingViaWhatsApp = async () => {
    if (meetings.length === 0) {
      toast.error("No meetings", { description: "There is no meeting to share." });
      return;
    }
    const latestMeeting = meetings.reduce((latest, current) => new Date(current.meeting_date) > new Date(latest.meeting_date) ? current : latest, meetings[0]);
    const message = `Latest meeting details:\n\nDate: ${format(new Date(latestMeeting.meeting_date), settings.dateFormat)}\nAgenda: ${latestMeeting.agenda}${latestMeeting.decisions ? `\nDecisions: ${latestMeeting.decisions}` : ""}`;
    const api = (window as any).electronAPI;
    if (!api?.openExternal) {
      toast.error("Unable to open WhatsApp", { description: "Desktop API not available." });
      return;
    }
    const membersToMessage = members.filter((member) => member.phone).map((member) => ({ id: member.id, name: member.name, phone: member.phone as string }));
    if (membersToMessage.length === 0) {
      toast.error("No phone numbers", { description: "No members have a phone number to send WhatsApp messages." });
      return;
    }
    for (const member of membersToMessage) {
      const phone = member.phone.replace(/\D/g, "");
      if (!phone) continue;
      const encoded = encodeURIComponent(`Hello ${member.name}, ${message}`);
      const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
      await api.openExternal(url);
      await delay(300);
    }
    toast.success("WhatsApp opened", { description: `WhatsApp share opened for ${membersToMessage.length} members.` });
  };

  const viewedMeeting = meetings.find(m => m.id === viewMeetingId);

  if (isLoading || membersLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md">
            <CalendarDays className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Meeting Records</h2>
            <p className="text-sm text-muted-foreground">Schedule and document meetings</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="secondary" className="gap-2" onClick={shareLatestMeetingViaWhatsApp}><Users className="w-4 h-4" /> Share Latest Meeting</Button>
            {/* Schedule Dialog */}
            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Clock className="w-4 h-4" /> Schedule Meeting</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Schedule Upcoming Meeting</h2>
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
                  <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Add New Meeting</h2>
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
                          <FormItem><FormLabel className="text-xs font-medium">Meeting Date</FormLabel><FormControl><DatePicker date={field.value} onDateChange={field.onChange} placeholder="Select date" /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="agenda" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Agenda</FormLabel><FormControl><Textarea {...field} placeholder="Meeting agenda…" className="resize-none" rows={2} /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                        <FormField control={form.control} name="decisions" render={({ field }) => (
                          <FormItem><FormLabel className="text-xs font-medium">Decisions Made</FormLabel><FormControl><Textarea {...field} placeholder="Decisions made during the meeting…" className="resize-none" rows={2} /></FormControl><FormMessage className="text-xs" /></FormItem>
                        )} />
                      </div>
                      {/* Attendance */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member Attendance & Contributions</p>
                        <div className="grid grid-cols-12 px-3 py-2 bg-muted/50 rounded-lg">
                          <span className="col-span-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
                          <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Present</span>
                          <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount (PKR)</span>
                        </div>
                        <div className="space-y-1.5">
                          {memberContributions.map((mc) => (
                            <div key={mc.memberId} className="grid grid-cols-12 items-center px-3 py-2.5 rounded-lg border border-border/60 hover:bg-muted/20 transition-colors">
                              <div className="col-span-5 flex items-center gap-2">
                                <Avatar className="h-7 w-7"><AvatarFallback className="bg-gradient-primary text-white text-xs">{mc.memberName.split(" ").map(n => n[0]).join("")}</AvatarFallback></Avatar>
                                <span className="text-sm font-medium truncate">{mc.memberName}</span>
                              </div>
                              <div className="col-span-3 flex items-center gap-2">
                                <Checkbox checked={mc.present} onCheckedChange={(c) => updateContribution(mc.memberId, 'present', !!c)} />
                                <span className="text-xs text-muted-foreground">{mc.present ? "Yes" : "No"}</span>
                              </div>
                              <div className="col-span-4">
                                <Input type="number" placeholder="0" value={mc.amount || ""} className="h-8 text-sm"
                                  onChange={(e) => updateContribution(mc.memberId, 'amount', Number(e.target.value) || 0)} />
                              </div>
                            </div>
                          ))}
                        </div>
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
        <Card className="shadow-md border-0 border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              Upcoming Meetings
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-normal">{upcomingMeetings.length} scheduled</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {format(new Date(meeting.meeting_date), settings.dateFormat)}
                        {meeting.meeting_time && <span className="text-muted-foreground font-normal"> at {formatTimeTo12Hour(meeting.meeting_time)}</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{meeting.venue}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:text-destructive" onClick={() => setUpcomingToDelete(meeting)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Meetings */}
      <Card className="shadow-md border-0">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-primary" />
              </div>
              All Meetings
            </div>
            {meetings.length > 0 && <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-normal">{meetings.length} records</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {meetings.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <CalendarDays className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No meetings recorded yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{format(new Date(meeting.meeting_date), settings.dateFormat)}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-xs">{meeting.agenda}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={viewMeetingId === meeting.id} onOpenChange={(o) => { if (o) handleViewMeeting(meeting); else setViewMeetingId(null); }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 h-8"><Eye className="w-3.5 h-3.5" /> View</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h2 className="text-base font-bold text-foreground">Meeting Details</h2>
                            <p className="text-xs text-muted-foreground">{format(new Date(meeting.meeting_date), settings.dateFormat)}</p>
                          </div>
                        </div>
                        {viewedMeeting && (
                          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
                            <div className="p-4 rounded-lg bg-muted/40 border border-border/60 space-y-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Agenda</p>
                                <p className="text-sm text-foreground">{viewedMeeting.agenda}</p>
                              </div>
                              {viewedMeeting.decisions && (
                                <div className="pt-3 border-t border-border/60">
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Decisions Made</p>
                                  <p className="text-sm text-foreground">{viewedMeeting.decisions}</p>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/40 text-center">
                                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Present</p>
                                <p className="text-3xl font-bold text-emerald-600">{viewMeetingData.attendance.filter((a: any) => a.present).length}</p>
                              </div>
                              <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/40 text-center">
                                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1">Absent</p>
                                <p className="text-3xl font-bold text-rose-600">{viewMeetingData.attendance.filter((a: any) => !a.present).length}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Attendance & Contributions</p>
                              {viewMeetingData.contributions.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No contributions recorded for this meeting.</p>
                              ) : (
                                <div className="divide-y divide-border/60 rounded-lg border border-border/60 overflow-hidden">
                                  <div className="grid grid-cols-12 px-4 py-2 bg-muted/50">
                                    <span className="col-span-7 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
                                    <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
                                    <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                                  </div>
                                  {viewMeetingData.contributions.map((contrib: any) => {
                                    const att = viewMeetingData.attendance.find((a: any) => a.member_id === contrib.member_id);
                                    return (
                                      <div key={contrib.id} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-muted/30 transition-colors">
                                        <span className="col-span-7 text-sm font-medium">{contrib.members?.name || "Unknown"}</span>
                                        <div className="col-span-2">
                                          <Badge variant={att?.present ? "default" : "secondary"} className="text-xs">{att?.present ? "Present" : "Absent"}</Badge>
                                        </div>
                                        <span className="col-span-3 text-sm font-bold text-foreground text-right">PKR {contrib.amount.toLocaleString()}</span>
                                      </div>
                                    );
                                  })}
                                  <div className="grid grid-cols-12 px-4 py-2.5 bg-muted/40 border-t border-border/60">
                                    <span className="col-span-9 text-xs font-semibold text-muted-foreground">Total Contributions</span>
                                    <span className="col-span-3 text-sm font-bold text-foreground text-right">PKR {viewMeetingData.contributions.reduce((s: number, c: any) => s + c.amount, 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              )}
                            </div>
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
