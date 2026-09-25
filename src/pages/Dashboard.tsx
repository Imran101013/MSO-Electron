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

  // Calculate total members
  const totalMembers = useMemo(() => {
    return members.length;
  }, [members]);

  // Each member's total_budget already includes both their monthly contributions and
  // their ratio share of any past profit distribution, so summing it here — rather than
  // summing contributions alone — is what actually reflects the organization's total fund.
  const totalBudget = useMemo(() => {
    return members.reduce((sum, m) => sum + m.total_budget, 0);
  }, [members]);

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

  const today = useMemo(() => format(new Date(), "EEEE, dd MMMM yyyy"), []);

  return (
    <div className="space-y-6">
      {/* Page Header — statement letterhead */}
      <div className="flex items-center justify-between border-b-2 border-primary/40 pb-4">
        <div>
          <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Daily Statement</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{today} · Mogh Students Organisation</p>
        </div>
      </div>

      {/* Stats Grid — printed summary slips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Members"
          value={isLoading ? "—" : totalMembers.toString()}
          icon={Users}
          iconColor="border-primary/40 bg-primary/10 text-primary"
        />
        <StatCard
          title="Total Budget"
          value={isLoading ? "—" : `${settings.currency} ${totalBudget.toLocaleString()}`}
          icon={Wallet}
          iconColor="border-secondary/40 bg-secondary/10 text-secondary"
        />
        <StatCard
          title="Active Loans"
          value={isLoading ? "—" : `${settings.currency} ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
          iconColor="border-destructive/40 bg-destructive/10 text-destructive"
        />
        <StatCard
          title="Reserve Fund"
          value={isLoading ? "—" : `${settings.currency} ${reserveFund.toLocaleString()}`}
          icon={PiggyBank}
          iconColor="border-accent/50 bg-accent/15 text-accent-foreground"
        />
        <StatCard
          title="Overdue Loans"
          value={isLoading ? "—" : `${loanStats.overdueCount} · ${settings.currency} ${loanStats.overdueAmount.toLocaleString()}`}
          icon={AlertTriangle}
          iconColor="border-destructive/40 bg-destructive/10 text-destructive"
        />
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm rounded-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {allUpcomingMeetings.length > 0 ? (
              <div className="space-y-0 divide-y divide-border">
                {allUpcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-8 h-8 rounded-sm border-2 border-primary/30 bg-primary/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{meeting.venue || "TBD"}</p>
                      <p className="figure text-sm font-bold text-primary mt-0.5">
                        {format(parseISO(meeting.date), settings.dateFormat)}
                        {meeting.time && ` at ${formatTimeTo12Hour(meeting.time)}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-sm border-2 border-border bg-muted flex items-center justify-center mx-auto mb-3">
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

        <Card className="shadow-sm rounded-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-secondary/40 bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-secondary" />
              </div>
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="divide-y divide-border">
              {[
                { label: "Total Members", value: isLoading ? "—" : totalMembers },
                { label: "Total Budget", value: isLoading ? "—" : `${settings.currency} ${totalBudget.toLocaleString()}` },
                { label: "Active Loans", value: isLoading ? "—" : `${settings.currency} ${activeLoans.toLocaleString()}` },
                { label: "Reserve Fund", value: isLoading ? "—" : `${settings.currency} ${reserveFund.toLocaleString()}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="figure text-sm font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm rounded-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              Monthly Budget Trend
            </CardTitle>
            <CardDescription className="text-xs">Organization's total budget over time</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {budgetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={budgetData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <Tooltip formatter={(value) => `${settings.currency} ${Number(value).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="budget" fill="hsl(var(--primary))" name="Budget Contributions" radius={[2, 2, 0, 0]} />
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

        <Card className="shadow-sm rounded-sm">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-secondary/40 bg-secondary/10 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-secondary" />
              </div>
              Monthly Loans Trend
            </CardTitle>
            <CardDescription className="text-xs">Loans issued and recovered trends</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loansData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={loansData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <Tooltip formatter={(value) => `${settings.currency} ${Number(value).toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="issued" fill="hsl(var(--destructive))" name="Loans Issued" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="recovered" fill="hsl(var(--secondary))" name="Loans Recovered" radius={[2, 2, 0, 0]} />
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
