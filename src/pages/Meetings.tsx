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
import { useAuth } from "@/contexts/AuthContext";

const meetingSchema = z.object({
  date: z.string().min(1, "Date is required"),
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
  date: z.string().min(1, "Date is required"),
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
  const { isAdmin, user } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [viewMeetingId, setViewMeetingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<MeetingFormValues>({
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
          <h2 className="text-3xl font-bold text-foreground">
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
                              <Input type="date" {...field} />
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
                              <Input type="date" {...field} />
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
                            <Input
                              placeholder="Search member..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-48"
                            />
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

                        {searchQuery && filteredMembers.length > 0 && (
                          <div className="border rounded-lg p-2 max-h-48 overflow-y-auto">
                            {filteredMembers.map((member) => (
                              <Button
                                key={member.id}
                                type="button"
                                variant="ghost"
                                className="w-full justify-start"
                                onClick={() => {
                                  appendContribution({
                                    memberId: member.id,
                                    amount: 0,
                                    present: true,
                                  });
                                  setSearchQuery("");
                                }}>
                                {member.name}
                              </Button>
                            ))}
                          </div>
                        )}
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
                          {new Date(meeting.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {meeting.contributions.length} contributions
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
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
                        <Button variant="outline" size="sm" className="gap-2">
                          <Eye className="w-4 h-4" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>
                            Meeting Details -{" "}
                            {new Date(meeting.date).toLocaleDateString()}
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
    </div>
  );
}
