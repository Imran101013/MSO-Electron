import StatCard from "@/components/StatCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Users,
  Wallet,
  HandCoins,
  PiggyBank,
  Calendar,
  TrendingUp,
  Clock,
} from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, parseISO, isPast } from "date-fns";
import { useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function Dashboard() {
  const {
    totalBudget,
    totalMembers,
    activeLoans,
    reserveFund,
    upcomingMeetings,
    setUpcomingMeetings,
    budgetTrend,
    membersTrend,
    loansTrend,
    reserveTrend,
    meetings,
  } = useOrganization();

  // Filter out past meetings
  useEffect(() => {
    const filteredMeetings = upcomingMeetings.filter((meeting) => {
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
        <p className="text-muted-foreground mt-1">Welcome to AL-Hilal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Members"
          value={totalMembers.toString()}
          icon={Users}
          trend={
            membersTrend
              ? `${membersTrend.amount >= 0 ? "+" : ""}${
                  membersTrend.amount
                } this month`
              : undefined
          }
          trendUp={membersTrend ? membersTrend.amount >= 0 : undefined}
          bgColor="bg-blue-100"
        />
        <StatCard
          title="Total Budget"
          value={`PKR ${totalBudget.toLocaleString()}`}
          icon={Wallet}
          trend={
            budgetTrend
              ? `${budgetTrend.amount >= 0 ? "+" : ""}PKR ${Math.abs(
                  budgetTrend.amount
                ).toLocaleString()} (${budgetTrend.percentage.toFixed(1)}%)`
              : undefined
          }
          trendUp={budgetTrend ? budgetTrend.amount >= 0 : undefined}
          bgColor="bg-green-100"
        />
        <StatCard
          title="Active Loans"
          value={`PKR ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
          trend={
            loansTrend
              ? `${loansTrend.amount >= 0 ? "+" : ""}PKR ${Math.abs(
                  loansTrend.amount
                ).toLocaleString()} net change`
              : undefined
          }
          trendUp={loansTrend ? loansTrend.amount < 0 : undefined}
          bgColor="bg-yellow-100"
        />
        <StatCard
          title="Reserve Fund"
          value={`PKR ${reserveFund.toLocaleString()}`}
          icon={PiggyBank}
          trend={
            reserveTrend
              ? `${reserveTrend.amount >= 0 ? "+" : ""}PKR ${Math.abs(
                  reserveTrend.amount
                ).toLocaleString()}`
              : undefined
          }
          trendUp={reserveTrend ? reserveTrend.amount >= 0 : undefined}
          bgColor="bg-purple-100"
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
                {upcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-foreground">
                              {meeting.venue}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(parseISO(meeting.date), "PPP")} at{" "}
                              {meeting.time}
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
                <p className="text-sm text-muted-foreground">
                  No upcoming meetings scheduled
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Schedule a meeting from the Meetings page
                </p>
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
                <span className="text-sm text-muted-foreground">
                  Total Members
                </span>
                <span className="text-lg font-bold text-foreground">
                  {totalMembers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Total Budget
                </span>
                <span className="text-lg font-bold text-foreground">
                  PKR {totalBudget.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Active Loans
                </span>
                <span className="text-lg font-bold text-foreground">
                  PKR {activeLoans.toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Trend Graph */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Monthly Budget Trend
            </CardTitle>
            <CardDescription>
              Organization's total budget over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {meetings.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={meetings.map((m) => {
                    const monthDate = new Date(m.date);
                    return {
                      month: format(monthDate, "MMM dd"),
                      budget: m.contributions.reduce(
                        (sum, c) => sum + c.amount,
                        0
                      ),
                    };
                  })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => `PKR ${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="budget"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    name="Budget Contributions"
                    dot={{ fill: "#8b5cf6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">
                  No data available yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loans Trend Graph */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HandCoins className="w-5 h-5 text-secondary" />
              Monthly Loans Trend
            </CardTitle>
            <CardDescription>Loans issued and recovered trends</CardDescription>
          </CardHeader>
          <CardContent>
            {meetings.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={meetings.map((m) => {
                    const monthDate = new Date(m.date);
                    const issued = m.loanIssues.reduce(
                      (sum, l) => sum + l.amount,
                      0
                    );
                    const collected = m.loanCollections.reduce(
                      (sum, l) => sum + l.amount,
                      0
                    );
                    return {
                      month: format(monthDate, "MMM dd"),
                      issued,
                      collected,
                    };
                  })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => `PKR ${value.toLocaleString()}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="issued"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Loans Issued"
                    dot={{ fill: "#ef4444", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="collected"
                    stroke="#22c55e"
                    strokeWidth={2}
                    name="Loans Recovered"
                    dot={{ fill: "#22c55e", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">
                  No data available yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
