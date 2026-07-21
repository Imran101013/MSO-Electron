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
  AlertTriangle,
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
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { settings } = useSettings();
  const { members, isLoading: membersLoading } = useMembers();
  const { meetings, upcomingMeetings, isLoading: meetingsLoading } = useMeetings();
  const { loans, installments, getLoanStats, isLoading: loansLoading } = useLoans();
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

  const loanStats = useMemo(() => getLoanStats(), [getLoanStats, loans]);

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Overview of MSO activity</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Members"
          value={isLoading ? "—" : totalMembers.toString()}
          icon={Users}
          iconColor="bg-gradient-primary"
        />
        <StatCard
          title="Total Budget"
          value={isLoading ? "—" : `PKR ${totalBudget.toLocaleString()}`}
          icon={Wallet}
          iconColor="bg-gradient-secondary"
        />
        <StatCard
          title="Active Loans"
          value={isLoading ? "—" : `PKR ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
          iconColor="bg-rose-500"
        />
        <StatCard
          title="Reserve Fund"
          value={isLoading ? "—" : `PKR ${reserveFund.toLocaleString()}`}
          icon={PiggyBank}
          iconColor="bg-gradient-accent"
        />
        <StatCard
          title="Overdue Loans"
          value={isLoading ? "—" : `${loanStats.overdueCount} · PKR ${loanStats.overdueAmount.toLocaleString()}`}
          icon={AlertTriangle}
          iconColor="bg-amber-500"
        />
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allUpcomingMeetings.length > 0 ? (
              <div className="space-y-3">
                {allUpcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{meeting.venue || "TBD"}</p>
                      <p className="text-sm font-bold text-primary mt-0.5">
                        {format(parseISO(meeting.date), settings.dateFormat)}
                        {meeting.time && ` at ${formatTimeTo12Hour(meeting.time)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No upcoming meetings</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link to="/meetings" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">
                    Schedule one from the Meetings page
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-xl bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-secondary" />
              </div>
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Total Members", value: isLoading ? "—" : totalMembers },
                { label: "Total Budget", value: isLoading ? "—" : `PKR ${totalBudget.toLocaleString()}` },
                { label: "Active Loans", value: isLoading ? "—" : `PKR ${activeLoans.toLocaleString()}` },
                { label: "Reserve Fund", value: isLoading ? "—" : `PKR ${reserveFund.toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              Monthly Budget Trend
            </CardTitle>
            <CardDescription className="text-xs">Organization's total budget over time</CardDescription>
          </CardHeader>
          <CardContent>
            {budgetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={budgetData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="budget" fill="hsl(var(--primary))" name="Budget Contributions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No data available yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link to="/meetings" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">
                    Record a meeting to see this chart populate
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-xl bg-secondary/10 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-secondary" />
              </div>
              Monthly Loans Trend
            </CardTitle>
            <CardDescription className="text-xs">Loans issued and recovered trends</CardDescription>
          </CardHeader>
          <CardContent>
            {loansData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={loansData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => `PKR ${Number(value).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="issued" fill="hsl(var(--destructive))" name="Loans Issued" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recovered" fill="hsl(var(--secondary))" name="Loans Recovered" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No data available yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link to="/loans" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">
                    Issue or record a loan to see this chart populate
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
