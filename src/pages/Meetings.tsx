import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Calendar,
  Eye,
  Users,
  DollarSign,
  FileText,
  Clock,
  Search,
  Edit,
  Trash2,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm, useFieldArray } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { formatTimeTo12Hour } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";

const meetingSchema = z.object({
  date: z.date(),
  agenda: z.string().min(1, "Agenda is required"),
  decisions: z.string().min(1, "Decisions are required"),
  contributions: z
    .array(
      z.object({
        memberId: z.number().min(1),
        amount: z.number().min(0),
        present: z.boolean(),
      })
    )
    .default([]),
});

const upcomingMeetingSchema = z.object({
  date: z.date(),
  time: z.string().min(1, "Time is required"),
  venue: z.string().min(1, "Venue is required"),
});

type MeetingFormValues = z.infer<typeof meetingSchema>;
type UpcomingMeetingFormValues = z.infer<typeof upcomingMeetingSchema>;

export default function Meetings() {
  const {
    members,
    setMembers,
    meetings,
    setMeetings,
    upcomingMeetings,
    setUpcomingMeetings,
  } = useOrganization();
  const { settings } = useSettings();
  const { isAdmin, user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewMeetingId, setViewMeetingId] = useState<number | null>(null);
  const [editMeetingId, setEditMeetingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      date: undefined,
      agenda: "",
      decisions: "",
      contributions: [],
    },
  });

  const editForm = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      date: "",
      agenda: "",
      decisions: "",
      contributions: [],
    },
  });

  const {
    fields: contributionFields,
    append: appendContribution,
    remove: removeContribution,
  } = useFieldArray({
    control: form.control,
    name: "contributions",
  });

  const {
    fields: editContributionFields,
    append: appendEditContribution,
    remove: removeEditContribution,
  } = useFieldArray({
    control: editForm.control,
    name: "contributions",
  });

  const scheduleForm = useForm<UpcomingMeetingFormValues>({
    resolver: zodResolver(upcomingMeetingSchema),
    defaultValues: {
      date: "",
      time: "",
      venue: "",
    },
  });

  const filteredMembers = members.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onSubmit = (data: MeetingFormValues) => {
    const newMeeting = {
      id: meetings.length + 1,
      date: data.date,
      agenda: data.agenda,
      decisions: data.decisions,
      contributions:
        data.contributions as (typeof meetings)[0]["contributions"],
      loanCollections: [] as (typeof meetings)[0]["loanCollections"],
      loanIssues: [] as (typeof meetings)[0]["loanIssues"],
      reserveFundDonations: [] as (typeof meetings)[0]["reserveFundDonations"],
    };

    // Update members' budget and contribution history
    const updatedMembers = members.map((member) => {
      const contribution = data.contributions.find(
        (c) => c.memberId === member.id
      );

      let updatedMember = { ...member };

      // Handle contributions and attendance
      if (contribution) {
        // If an amount was provided, count it toward the budget regardless of physical presence
        if (contribution.amount > 0) {
          updatedMember = {
            ...updatedMember,
            monthlyContributions: [
              ...updatedMember.monthlyContributions,
              {
                month: data.date,
                amount: contribution.amount,
                // infer paid from whether an amount was provided
                paid: contribution.amount > 0,
              },
            ],
            attendance: [
              ...updatedMember.attendance,
              {
                date: data.date,
                present: !!contribution.present,
              },
            ],
            totalBudget: updatedMember.totalBudget + contribution.amount,
          };
        } else {
          // No amount, still record attendance (present may be true/false)
          updatedMember = {
            ...updatedMember,
            attendance: [
              ...updatedMember.attendance,
              {
                date: data.date,
                present: !!contribution.present,
              },
            ],
          };
        }
      }

      return updatedMember;
    });

    setMembers(updatedMembers);
    setMeetings([...meetings, newMeeting]);

    const totalContributed = data.contributions.reduce(
      (sum, c) => sum + (c.amount || 0),
      0
    );
    toast.success(
      `Meeting added successfully! Total contributions: PKR ${totalContributed.toLocaleString()}`
    );

    setIsAddOpen(false);
    form.reset();
  };

  const onEditSubmit = (data: MeetingFormValues) => {
    if (!editMeetingId) return;

    const meetingToEdit = meetings.find((m) => m.id === editMeetingId);
    if (!meetingToEdit) return;

    // Calculate the difference in contributions to update members' budgets
    const oldContributions = meetingToEdit.contributions;
    const newContributions = data.contributions;

    // Update members' budget and contribution history
    const updatedMembers = members.map((member) => {
      const oldContrib = oldContributions.find((c) => c.memberId === member.id);
      const newContrib = newContributions.find((c) => c.memberId === member.id);

      let updatedMember = { ...member };

      // Remove old contribution records for this meeting
      if (oldContrib) {
        if (oldContrib.amount > 0) {
          updatedMember = {
            ...updatedMember,
            monthlyContributions: updatedMember.monthlyContributions.filter(
              (mc) =>
                !(
                  mc.month === meetingToEdit.date &&
                  mc.amount === oldContrib.amount
                )
            ),
            totalBudget: updatedMember.totalBudget - oldContrib.amount,
          };
        }
        updatedMember = {
          ...updatedMember,
          attendance: updatedMember.attendance.filter(
            (a) =>
              !(
                a.date === meetingToEdit.date &&
                a.present === oldContrib.present
              )
          ),
        };
      }

      // Add new contribution records
      if (newContrib) {
        if (newContrib.amount > 0) {
          updatedMember = {
            ...updatedMember,
            monthlyContributions: [
              ...updatedMember.monthlyContributions,
              {
                month: data.date,
                amount: newContrib.amount,
                paid: newContrib.amount > 0,
              },
            ],
            totalBudget: updatedMember.totalBudget + newContrib.amount,
          };
        }
        updatedMember = {
          ...updatedMember,
          attendance: [
            ...updatedMember.attendance,
            {
              date: data.date,
              present: !!newContrib.present,
            },
          ],
        };
      }

      return updatedMember;
    });

    // Update the meeting
    const updatedMeetings = meetings.map((m) =>
      m.id === editMeetingId
        ? {
            ...m,
            date: data.date,
            agenda: data.agenda,
            decisions: data.decisions,
            contributions:
              data.contributions as (typeof meetings)[0]["contributions"],
          }
        : m
    );

    setMembers(updatedMembers);
    setMeetings(updatedMeetings);

    toast.success("Meeting updated successfully");
    setEditMeetingId(null);
    editForm.reset();
  };

  const handleEditMeeting = (meeting: (typeof meetings)[0]) => {
    editForm.reset({
      date: meeting.date,
      agenda: meeting.agenda,
      decisions: meeting.decisions,
      contributions: meeting.contributions,
    });
    setEditMeetingId(meeting.id);
    setViewMeetingId(null);
  };

  const handleDeleteMeeting = (meetingId: number) => {
    const meetingToDelete = meetings.find((m) => m.id === meetingId);
    if (!meetingToDelete) return;

    // Revert member budget and attendance changes
    const updatedMembers = members.map((member) => {
      const contrib = meetingToDelete.contributions.find(
        (c) => c.memberId === member.id
      );

      let updatedMember = { ...member };

      if (contrib) {
        if (contrib.amount > 0) {
          updatedMember = {
            ...updatedMember,
            monthlyContributions: updatedMember.monthlyContributions.filter(
              (mc) =>
                !(
                  mc.month === meetingToDelete.date &&
                  mc.amount === contrib.amount
                )
            ),
            totalBudget: Math.max(
              0,
              updatedMember.totalBudget - contrib.amount
            ),
          };
        }
        updatedMember = {
          ...updatedMember,
          attendance: updatedMember.attendance.filter(
            (a) =>
              !(
                a.date === meetingToDelete.date && a.present === contrib.present
              )
          ),
        };
      }

      return updatedMember;
    });

    setMembers(updatedMembers);
    setMeetings(meetings.filter((m) => m.id !== meetingId));
    toast.success("Meeting deleted successfully");
    setViewMeetingId(null);
  };

  const viewedMeeting = meetings.find((m) => m.id === viewMeetingId);

  const onScheduleSubmit = (data: UpcomingMeetingFormValues) => {
    const newUpcomingMeeting = {
      id: upcomingMeetings.length + 1,
      date: data.date,
      time: data.time,
      venue: data.venue,
    };

    setUpcomingMeetings([...upcomingMeetings, newUpcomingMeeting]);
    toast.success("Meeting scheduled successfully");
    setIsScheduleOpen(false);
    scheduleForm.reset();
  };

  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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
        <div className="flex gap-2">
          {isAdmin && (
            <>
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
                    <form
                      onSubmit={scheduleForm.handleSubmit(onScheduleSubmit)}
                      className="space-y-4">
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
                              <Textarea
                                {...field}
                                placeholder="Meeting venue..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" className="w-full">
                        Schedule Meeting
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
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
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6">
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
                              <Textarea
                                {...field}
                                placeholder="Meeting agenda..."
                              />
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
                              <Textarea
                                {...field}
                                placeholder="Decisions made during the meeting..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">
                            Member Contributions
                          </h3>
                          <div className="flex gap-2">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              <Input
                                placeholder="Search member..."
                                value={searchQuery}
                                onChange={(e) => {
                                  setSearchQuery(e.target.value);
                                  setShowSuggestions(e.target.value.length > 0);
                                }}
                                className="w-48 pl-10"
                                onFocus={() =>
                                  searchQuery.length > 0 &&
                                  setShowSuggestions(true)
                                }
                                onBlur={() => {
                                  setTimeout(
                                    () => setShowSuggestions(false),
                                    200
                                  );
                                }}
                              />
                              {showSuggestions &&
                                filteredMembers.length > 0 && (
                                  <div
                                    className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
                                    onMouseDown={(e) => e.preventDefault()}>
                                    {filteredMembers.map((member) => (
                                      <button
                                        key={member.id}
                                        type="button"
                                        onClick={() => {
                                          appendContribution({
                                            memberId: member.id,
                                            amount: 0,
                                            present: true,
                                          });
                                          setSearchQuery("");
                                          setShowSuggestions(false);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border last:border-b-0">
                                        <Avatar className="h-8 w-8 flex-shrink-0">
                                          <AvatarImage
                                            src={member.profilePicture}
                                          />
                                          <AvatarFallback className="bg-gradient-primary">
                                            <span className="text-primary-foreground text-sm font-semibold">
                                              {member.name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")}
                                            </span>
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-foreground truncate">
                                            {member.name}
                                          </p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {member.email}
                                          </p>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>

                        {contributionFields.map((field, index) => {
                          const member = members.find(
                            (m) => m.id === field.memberId
                          );
                          return (
                            <div
                              key={field.id}
                              className="flex gap-4 items-end p-4 border rounded-lg">
                              <div className="flex-1">
                                <Label>Member: {member?.name}</Label>
                              </div>
                              <FormField
                                control={form.control}
                                name={`contributions.${index}.amount`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormLabel>Amount (PKR)</FormLabel>
                                    <FormControl>
                                      <Input
                                        type="number"
                                        {...field}
                                        onChange={(e) =>
                                          field.onChange(Number(e.target.value))
                                        }
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`contributions.${index}.present`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <FormLabel className="!mt-0">
                                      Present
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeContribution(index)}>
                                Remove
                              </Button>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex justify-end gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsAddOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Save Meeting</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>All Meetings</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedMeetings.length > 0 ? (
            <div className="space-y-4">
              {sortedMeetings.map((meeting) => (
                <div key={meeting.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {format(new Date(meeting.date), settings.dateFormat)}
                        </p>
                        <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {meeting.contributions.length} contributions
                          </span>
                          <span className="flex items-center gap-1">
                            PKR{" "}
                            {meeting.contributions
                              .reduce((s, c) => s + c.amount, 0)
                              .toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Dialog
                      open={viewMeetingId === meeting.id}
                      onOpenChange={(open) =>
                        setViewMeetingId(open ? meeting.id : null)
                      }>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 pb-1">
                          <Eye className="w-4 h-4" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            Meeting Details -{" "}
                            {format(
                              new Date(meeting.date),
                              settings.dateFormat
                            )}
                          </DialogTitle>
                        </DialogHeader>
                        {viewedMeeting && (
                          <div className="space-y-6">
                            <div>
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Agenda
                              </h3>
                              <p className="text-muted-foreground">
                                {viewedMeeting.agenda}
                              </p>
                            </div>

                            <div>
                              <h3 className="font-semibold mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Decisions Made
                              </h3>
                              <p className="text-muted-foreground">
                                {viewedMeeting.decisions}
                              </p>
                            </div>

                            <div>
                              <h3 className="font-semibold mb-3">
                                Budget Collections
                              </h3>
                              <div className="space-y-2">
                                {viewedMeeting.contributions.map(
                                  (contrib, idx) => {
                                    const member = members.find(
                                      (m) => m.id === contrib.memberId
                                    );
                                    return (
                                      <div
                                        key={idx}
                                        className="flex justify-between items-center p-3 rounded-lg bg-muted/50">
                                        <div className="flex items-center gap-2">
                                          <span>
                                            {member?.name || "Unknown"}
                                          </span>
                                          <Badge
                                            variant={
                                              contrib.present
                                                ? "default"
                                                : "secondary"
                                            }>
                                            {contrib.present
                                              ? "Present"
                                              : "Absent"}
                                          </Badge>
                                        </div>
                                        <span className="font-semibold">
                                          PKR {contrib.amount.toLocaleString()}
                                        </span>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            </div>

                            <div>
                              <h3 className="font-semibold mb-3">
                                Attendance Summary
                              </h3>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-lg bg-green-500/10">
                                  <p className="text-sm text-muted-foreground">
                                    Present
                                  </p>
                                  <p className="text-2xl font-bold text-green-600">
                                    {
                                      viewedMeeting.contributions.filter(
                                        (c) => c.present
                                      ).length
                                    }
                                  </p>
                                </div>
                                <div className="p-4 rounded-lg bg-red-500/10">
                                  <p className="text-sm text-muted-foreground">
                                    Absent
                                  </p>
                                  <p className="text-2xl font-bold text-red-600">
                                    {
                                      viewedMeeting.contributions.filter(
                                        (c) => !c.present
                                      ).length
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between gap-2 pt-4 border-t">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDeleteMeeting(viewedMeeting.id)
                                }
                                className="p-2 gap-2">
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleEditMeeting(viewedMeeting)}
                                className="p-2 gap-2">
                                <Edit className="w-4 h-4" />
                                Edit Meeting
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No meetings recorded
              </h3>
              <p className="text-muted-foreground mb-6">
                Start by adding your first meeting record
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {editMeetingId && (
        <Dialog
          open={!!editMeetingId}
          onOpenChange={(open) => !open && setEditMeetingId(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Meeting</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit(onEditSubmit)}
                className="space-y-6">
                <FormField
                  control={editForm.control}
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
                  control={editForm.control}
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
                  control={editForm.control}
                  name="decisions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Decisions Made</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Decisions made during the meeting..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      Member Contributions
                    </h3>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search member..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowSuggestions(e.target.value.length > 0);
                          }}
                          className="w-48 pl-10"
                          onFocus={() =>
                            searchQuery.length > 0 && setShowSuggestions(true)
                          }
                          onBlur={() => {
                            setTimeout(() => setShowSuggestions(false), 200);
                          }}
                        />
                        {showSuggestions && filteredMembers.length > 0 && (
                          <div
                            className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
                            onMouseDown={(e) => e.preventDefault()}>
                            {filteredMembers.map((member) => {
                              const alreadyAdded = editForm
                                .getValues("contributions")
                                .some((c) => c.memberId === member.id);
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  disabled={alreadyAdded}
                                  onClick={() => {
                                    appendEditContribution({
                                      memberId: member.id,
                                      amount: 0,
                                      present: true,
                                    });
                                    setSearchQuery("");
                                    setShowSuggestions(false);
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed">
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    <AvatarImage src={member.profilePicture} />
                                    <AvatarFallback className="bg-gradient-primary">
                                      <span className="text-primary-foreground text-sm font-semibold">
                                        {member.name
                                          .split(" ")
                                          .map((n) => n[0])
                                          .join("")}
                                      </span>
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-foreground truncate">
                                      {member.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {member.email}
                                    </p>
                                  </div>
                                  {alreadyAdded && (
                                    <Badge variant="secondary">Added</Badge>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {editContributionFields.map((field, index) => {
                      const member = members.find(
                        (m) =>
                          m.id ===
                          editForm.getValues(`contributions.${index}.memberId`)
                      );
                      return (
                        <div
                          key={field.id}
                          className="flex gap-3 items-end p-3 rounded-lg bg-muted/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-1">
                              {member?.name || "Unknown Member"}
                            </p>
                            <div className="flex gap-2">
                              <FormField
                                control={editForm.control}
                                name={`contributions.${index}.amount`}
                                render={({ field }) => (
                                  <FormItem className="flex-1">
                                    <FormControl>
                                      <Input
                                        type="number"
                                        min="0"
                                        placeholder="Amount"
                                        {...field}
                                        onChange={(e) =>
                                          field.onChange(
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={editForm.control}
                                name={`contributions.${index}.present`}
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <label className="text-xs text-muted-foreground cursor-pointer">
                                      Present
                                    </label>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEditContribution(index)}>
                            ✕
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditMeetingId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit">Update Meeting</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
