import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  Eye,
  Users,
  FileText,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { formatTimeTo12Hour } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { useMeetings, DbMeeting } from "@/hooks/useMeetings";
import { useMembers } from "@/hooks/useMembers";
import { useAttendance } from "@/hooks/useAttendance";
import { useContributions } from "@/hooks/useContributions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const meetingSchema = z.object({
  date: z.date(),
  agenda: z.string().min(1, "Agenda is required"),
  decisions: z.string().optional(),
});

const upcomingMeetingSchema = z.object({
  date: z.date(),
  time: z.string().min(1, "Time is required"),
  venue: z.string().min(1, "Venue is required"),
});

type MeetingFormValues = z.infer<typeof meetingSchema>;
type UpcomingMeetingFormValues = z.infer<typeof upcomingMeetingSchema>;

interface MemberContribution {
  memberId: string;
  memberName: string;
  amount: number;
  present: boolean;
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberContributions, setMemberContributions] = useState<MemberContribution[]>([]);
  const [viewMeetingData, setViewMeetingData] = useState<{
    attendance: any[];
    contributions: any[];
  }>({ attendance: [], contributions: [] });

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      date: undefined,
      agenda: "",
      decisions: "",
    },
  });

  const scheduleForm = useForm<UpcomingMeetingFormValues>({
    resolver: zodResolver(upcomingMeetingSchema),
    defaultValues: {
      date: undefined,
      time: "",
      venue: "",
    },
  });

  const approvedMembers = members.filter(m => m.is_approved);

  const initializeMemberContributions = () => {
    setMemberContributions(
      approvedMembers.map(m => ({
        memberId: m.id,
        memberName: m.name,
        amount: 0,
        present: false,
      }))
    );
  };

  const handleOpenAddDialog = () => {
    initializeMemberContributions();
    setIsAddOpen(true);
  };

  const updateContribution = (memberId: string, field: 'amount' | 'present', value: number | boolean) => {
    setMemberContributions(prev =>
      prev.map(mc =>
        mc.memberId === memberId
          ? { ...mc, [field]: value }
          : mc
      )
    );
  };

  const onSubmit = async (data: MeetingFormValues) => {
    setIsSubmitting(true);
    
    const dateString = format(data.date, "yyyy-MM-dd");
    const newMeeting = await addMeeting({
      meeting_date: dateString,
      agenda: data.agenda,
      decisions: data.decisions,
    });

    if (newMeeting) {
      // Record attendance
      const attendanceList = memberContributions.map(mc => ({
        memberId: mc.memberId,
        present: mc.present,
      }));
      await bulkRecordAttendance(newMeeting.id, attendanceList);

      // Record contributions
      const contributionsList = memberContributions.map(mc => ({
        memberId: mc.memberId,
        amount: mc.amount,
      }));
      await bulkAddContributions(newMeeting.id, contributionsList, dateString);

      const totalContributed = memberContributions.reduce((sum, c) => sum + c.amount, 0);
      toast.success(`Meeting added! Total contributions: PKR ${totalContributed.toLocaleString()}`);
    }
    
    setIsSubmitting(false);
    setIsAddOpen(false);
    form.reset();
    setMemberContributions([]);
  };

  const onScheduleSubmit = async (data: UpcomingMeetingFormValues) => {
    setIsSubmitting(true);
    
    await addUpcomingMeeting({
      meeting_date: format(data.date, "yyyy-MM-dd"),
      meeting_time: data.time,
      venue: data.venue,
    });
    
    setIsSubmitting(false);
    setIsScheduleOpen(false);
    scheduleForm.reset();
  };

  const handleViewMeeting = async (meeting: DbMeeting) => {
    setViewMeetingId(meeting.id);
    
    // Fetch attendance and contributions for this meeting
    const [attendance, contributions] = await Promise.all([
      getAttendanceForMeeting(meeting.id),
      getContributionsByMeeting(meeting.id),
    ]);
    
    setViewMeetingData({ attendance, contributions });
  };

  const handleDeleteClick = (meeting: DbMeeting) => {
    setMeetingToDelete(meeting);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (meetingToDelete) {
      await deleteMeeting(meetingToDelete.id);
      setMeetingToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

  const viewedMeeting = meetings.find(m => m.id === viewMeetingId);

  if (isLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">
            Meeting Records
          </h2>
          <p className="text-muted-foreground mt-1">
            Schedule and document meetings
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Clock className="w-4 h-4" />
                  Schedule Meeting
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Upcoming Meeting</DialogTitle>
                </DialogHeader>
                <Form {...scheduleForm}>
                  <form onSubmit={scheduleForm.handleSubmit(onScheduleSubmit)} className="space-y-4">
                    <FormField
                      control={scheduleForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meeting Date</FormLabel>
                          <FormControl>
                            <DatePicker
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Select meeting date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={scheduleForm.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meeting Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={scheduleForm.control}
                      name="venue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Venue</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Meeting venue..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        "Schedule Meeting"
                      )}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isAddOpen} onOpenChange={(open) => {
              if (open) handleOpenAddDialog();
              else setIsAddOpen(false);
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add New Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Meeting</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Meeting Date</FormLabel>
                          <FormControl>
                            <DatePicker
                              date={field.value}
                              onDateChange={field.onChange}
                              placeholder="Select meeting date"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="agenda"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Agenda</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Meeting agenda..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="decisions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decisions Made</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Decisions made during the meeting..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Member Attendance & Contributions</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {memberContributions.map((mc) => (
                          <div key={mc.memberId} className="flex items-center gap-4 p-3 border rounded-lg">
                            <div className="flex items-center gap-2 flex-1">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-gradient-primary text-xs">
                                  {mc.memberName.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium text-sm">{mc.memberName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={mc.present}
                                onCheckedChange={(checked) => updateContribution(mc.memberId, 'present', !!checked)}
                              />
                              <span className="text-sm text-muted-foreground">Present</span>
                            </div>
                            <div className="w-32">
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={mc.amount || ""}
                                onChange={(e) => updateContribution(mc.memberId, 'amount', Number(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-4">
                      <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Meeting"
                        )}
                      </Button>
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
        <Card className="shadow-md border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {format(new Date(meeting.meeting_date), settings.dateFormat)}
                        {meeting.meeting_time && ` at ${formatTimeTo12Hour(meeting.meeting_time)}`}
                      </p>
                      <p className="text-sm text-muted-foreground">{meeting.venue}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteUpcomingMeeting(meeting.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past Meetings */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>All Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No meetings recorded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {format(new Date(meeting.meeting_date), settings.dateFormat)}
                        </p>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {meeting.agenda}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog
                        open={viewMeetingId === meeting.id}
                        onOpenChange={(open) => {
                          if (open) handleViewMeeting(meeting);
                          else setViewMeetingId(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Eye className="w-4 h-4" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              Meeting Details - {format(new Date(meeting.meeting_date), settings.dateFormat)}
                            </DialogTitle>
                          </DialogHeader>
                          {viewedMeeting && (
                            <div className="space-y-6">
                              <div>
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  Agenda
                                </h3>
                                <p className="text-muted-foreground">{viewedMeeting.agenda}</p>
                              </div>
                              {viewedMeeting.decisions && (
                                <div>
                                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Decisions Made
                                  </h3>
                                  <p className="text-muted-foreground">{viewedMeeting.decisions}</p>
                                </div>
                              )}
                              <div>
                                <h3 className="font-semibold mb-3">Attendance & Contributions</h3>
                                <div className="space-y-2">
                                  {viewMeetingData.contributions.length > 0 ? (
                                    viewMeetingData.contributions.map((contrib: any) => {
                                      const attendanceRecord = viewMeetingData.attendance.find(
                                        (a: any) => a.member_id === contrib.member_id
                                      );
                                      return (
                                        <div
                                          key={contrib.id}
                                          className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span>{contrib.members?.name || "Unknown"}</span>
                                            <Badge variant={attendanceRecord?.present ? "default" : "secondary"}>
                                              {attendanceRecord?.present ? "Present" : "Absent"}
                                            </Badge>
                                          </div>
                                          <span className="font-semibold">
                                            PKR {contrib.amount.toLocaleString()}
                                          </span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <p className="text-muted-foreground text-center py-4">
                                      No contributions recorded for this meeting.
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg bg-green-500/10">
                                  <p className="text-sm text-muted-foreground">Present</p>
                                  <p className="text-2xl font-bold text-green-600">
                                    {viewMeetingData.attendance.filter((a: any) => a.present).length}
                                  </p>
                                </div>
                                <div className="p-4 rounded-lg bg-red-500/10">
                                  <p className="text-sm text-muted-foreground">Absent</p>
                                  <p className="text-2xl font-bold text-red-600">
                                    {viewMeetingData.attendance.filter((a: any) => !a.present).length}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(meeting)}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
