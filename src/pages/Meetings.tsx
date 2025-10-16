import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const meetings = [
  { 
    id: 1, 
    title: "Monthly General Meeting", 
    date: "Mar 15, 2025", 
    time: "7:00 PM",
    attendees: 38,
    status: "upcoming",
    agenda: ["Budget review", "New loan applications", "Reserve fund allocation"]
  },
  { 
    id: 2, 
    title: "February Meeting", 
    date: "Feb 15, 2025", 
    time: "7:00 PM",
    attendees: 40,
    status: "completed",
    agenda: ["Monthly collection review", "Loan repayment updates"]
  },
];

export default function Meetings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Meeting Records</h2>
          <p className="text-muted-foreground mt-1">Schedule and document meetings</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Meeting
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {meetings.map((meeting) => (
          <Card key={meeting.id} className="shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle>{meeting.title}</CardTitle>
                    <Badge variant={meeting.status === 'upcoming' ? 'default' : 'secondary'}>
                      {meeting.status === 'upcoming' ? 'Upcoming' : 'Completed'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {meeting.date} at {meeting.time}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {meeting.attendees} attendees
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Agenda:</p>
                <ul className="space-y-1">
                  {meeting.agenda.map((item, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
