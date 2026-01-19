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
import { useSettings } from "@/contexts/SettingsContext";
import { format, parseISO, isFuture, isToday } from "date-fns";
import { formatTimeTo12Hour } from "@/lib/utils";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useMembers } from "@/hooks/useMembers";
import { useMeetings } from "@/hooks/useMeetings";
import { useLoans } from "@/hooks/useLoans";
import { useContributions } from "@/hooks/useContributions";
import { useReserveTransactions } from "@/hooks/useReserveTransactions";

export default function Dashboard() {
  const { settings } = useSettings();
  const { members, isLoading: membersLoading } = useMembers();
  const { meetings, upcomingMeetings, isLoading: meetingsLoading } = useMeetings();
  const { loans, installments, isLoading: loansLoading } = useLoans();
  const { contributions, isLoading: contributionsLoading } = useContributions();
  const { getReserveFundTotal, isLoading: reserveLoading } = useReserveTransactions();

  // Get future meetings from both tables
  const allUpcomingMeetings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Future meetings from meetings table (with agenda)
    const futureMeetings = meetings
      .filter(m => {
        const meetingDate = parseISO(m.meeting_date);
        return isFuture(meetingDate) || isToday(meetingDate);
      })
      .map(m => ({
        id: m.id,
        date: m.meeting_date,
        venue: m.agenda,
        time: null as string | null,
        type: 'meeting' as const,
      }));

    // Scheduled upcoming meetings (with venue/time)
    const scheduled = upcomingMeetings.map(m => ({
      id: m.id,
      date: m.meeting_date,
      venue: m.venue,
      time: m.meeting_time,
      type: 'upcoming' as const,
    }));

    // Combine and sort by date
    return [...futureMeetings, ...scheduled].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [meetings, upcomingMeetings]);

  // Calculate total members (only approved)
  const totalMembers = useMemo(() => {
    return members.filter(m => m.is_approved).length;
  }, [members]);

  // Calculate total budget from contributions
  const totalBudget = useMemo(() => {
    return contributions.reduce((sum, c) => sum + c.amount, 0);
  }, [contributions]);

  // Calculate active loans (remaining amount)
  const activeLoans = useMemo(() => {
    return loans
      .filter(loan => loan.status === "active")
      .reduce((sum, loan) => sum + loan.remaining_amount, 0);
  }, [loans]);

  // Reserve fund total
  const reserveFund = useMemo(() => {
    return getReserveFundTotal();
  }, [getReserveFundTotal]);

  // Aggregate budget contributions by month-year
  const budgetData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    contributions.forEach((contribution) => {
      const date = new Date(contribution.contribution_date);
      const monthKey = format(date, "yyyy-MM");
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + contribution.amount;
    });
    return Object.entries(monthlyData)
      .map(([month, budget]) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        budget,
      }))
      .sort(
        (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
      );
  }, [contributions]);

  // Aggregate loan issued by month-year
  const loanIssuedData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    loans.forEach((loan) => {
      const date = new Date(loan.loan_date);
      const monthKey = format(date, "yyyy-MM");
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + loan.amount;
    });
    return monthlyData;
  }, [loans]);

  // Aggregate loan recovered by month-year from installments
  const loanRecoveredData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    installments.forEach((installment) => {
      const date = new Date(installment.payment_date);
      const monthKey = format(date, "yyyy-MM");
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + installment.amount;
    });
    return monthlyData;
  }, [installments]);

  // Combine issued and recovered for loans trend
  const loansData = useMemo(() => {
    const allMonths = new Set([
      ...Object.keys(loanIssuedData),
      ...Object.keys(loanRecoveredData),
    ]);
    return Array.from(allMonths)
      .map((month) => ({
        month: format(new Date(month + "-01"), "MMM yyyy"),
        issued: loanIssuedData[month] || 0,
        recovered: loanRecoveredData[month] || 0,
      }))
      .sort(
        (a, b) => new Date(a.month).getTime() - new Date(b.month).getTime()
      );
  }, [loanIssuedData, loanRecoveredData]);

  const isLoading = membersLoading || meetingsLoading || loansLoading || contributionsLoading || reserveLoading;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-semibold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Welcome to MSO</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Members"
          value={isLoading ? "..." : totalMembers.toString()}
          icon={Users}
        />
        <StatCard
          title="Total Budget"
          value={isLoading ? "..." : `PKR ${totalBudget.toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard
          title="Active Loans"
          value={isLoading ? "..." : `PKR ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
        />
        <StatCard
          title="Reserve Fund"
          value={isLoading ? "..." : `PKR ${reserveFund.toLocaleString()}`}
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
            {allUpcomingMeetings.length > 0 ? (
              <div className="space-y-4">
                {allUpcomingMeetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="p-4 rounded-lg border bg-red-200">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-foreground">
                              {meeting.venue || "TBD"}
                            </h4>
                            <p className="text-xl font-bold text-orange-700 mt-1">
                              {format(
                                parseISO(meeting.date),
                                settings.dateFormat
                              )}{" "}
                              {meeting.time && `at ${formatTimeTo12Hour(meeting.time)}`}
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
                <span className="text-lg font-semibold text-foreground">
                  {isLoading ? "..." : totalMembers}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Total Budget
                </span>
                <span className="text-lg font-semibold text-foreground">
                  {isLoading ? "..." : `PKR ${totalBudget.toLocaleString()}`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Active Loans
                </span>
                <span className="text-lg font-semibold text-foreground">
                  {isLoading ? "..." : `PKR ${activeLoans.toLocaleString()}`}
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
            {budgetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => `PKR ${Number(value).toLocaleString()}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="budget"
                    fill="#8b5cf6"
                    name="Budget Contributions"
                  />
                </BarChart>
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
            {loansData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={loansData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => `PKR ${Number(value).toLocaleString()}`}
                  />
                  <Legend />
                  <Bar dataKey="issued" fill="#ef4444" name="Loans Issued" />
                  <Bar
                    dataKey="recovered"
                    fill="#22c55e"
                    name="Loans Recovered"
                  />
                </BarChart>
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
