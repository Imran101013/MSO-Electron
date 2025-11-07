import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, HandCoins, PiggyBank, Calendar, TrendingUp, Clock } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, parseISO, isPast } from "date-fns";
import { useEffect } from "react";

export default function Dashboard() {
  const { totalBudget, totalMembers, activeLoans, reserveFund, upcomingMeetings, setUpcomingMeetings } = useOrganization();

  // Filter out past meetings
  useEffect(() => {
    const filteredMeetings = upcomingMeetings.filter(meeting => {
      const meetingDateTime = parseISO(`${meeting.date}T${meeting.time}`);
      return !isPast(meetingDateTime);
    });
    
    if (filteredMeetings.length !== upcomingMeetings.length) {
      setUpcomingMeetings(filteredMeetings);
    }
  }, [upcomingMeetings, setUpcomingMeetings]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Welcome to AL-Hilal Organization Management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Members"
          value={totalMembers.toString()}
          icon={Users}
        />
        <StatCard
          title="Total Budget"
          value={`PKR ${totalBudget.toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard
          title="Active Loans"
          value={`PKR ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
        />
        <StatCard
          title="Reserve Fund"
          value={`PKR ${reserveFund.toLocaleString()}`}
          icon={PiggyBank}
        />
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length > 0 ? (
              <div className="space-y-4">
                {upcomingMeetings.map(meeting => (
                  <div key={meeting.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-foreground">{meeting.agenda}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(parseISO(meeting.date), "PPP")} at {meeting.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No upcoming meetings scheduled</p>
                <p className="text-xs text-muted-foreground mt-1">Schedule a meeting from the Meetings page</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Members</span>
                <span className="text-lg font-bold text-foreground">{totalMembers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Budget</span>
                <span className="text-lg font-bold text-foreground">PKR {totalBudget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Loans</span>
                <span className="text-lg font-bold text-foreground">PKR {activeLoans.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
