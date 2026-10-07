import StatCard from "@/components/StatCard";
import BackupReminder from "@/components/BackupReminder";
import AmountsNote from "@/components/AmountsNote";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Wallet,
  HandCoins,
  PiggyBank,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { format, differenceInCalendarDays } from "date-fns";
import { formatTime } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { useMembers } from "@/hooks/useMembers";
import { useMeetings } from "@/hooks/useMeetings";
import { parseLocalDate, useLoans } from "@/hooks/useLoans";
import { useContributions } from "@/hooks/useContributions";
import { useReserveTransactions } from "@/hooks/useReserveTransactions";
import { useTotalBudget } from "@/hooks/useTotalBudget";
import { loanDueDate } from "@/utils/loanPenalty";
import { getMeetingRecord, type MeetingRecord } from "@/utils/meetingShare";
import { Link } from "react-router-dom";

const LOAN_ROWS = 5;
const MEETING_ROWS = 3;

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const localDate = (date: string) => parseLocalDate(String(date).slice(0, 10));

/** Round axis steps (0, 10K, 20K…) instead of whatever evenly divides the tallest bar. */
function niceTicks(max: number, count = 4) {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

const axisTick = { fontSize: 11, fontFamily: "IBM Plex Mono", fill: "hsl(var(--muted-foreground))" };

export default function Dashboard() {
  const { settings } = useSettings();
  const { members, isLoading: membersLoading } = useMembers();
  const { meetings, upcomingMeetings, isLoading: meetingsLoading } = useMeetings();
  const { loans, installments, getLoanStats, isOverdue, isLoading: loansLoading } = useLoans();
  const { contributions, isLoading: contributionsLoading } = useContributions();
  const { getReserveFundTotal, isLoading: reserveLoading } = useReserveTransactions();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // The last meeting held. One recorded today counts as held: its attendance and savings are in.
  const lastMeeting = useMemo(() => {
    return meetings
      .filter(m => localDate(m.meeting_date) <= todayStart)
      .reduce<(typeof meetings)[number] | null>((a, b) => (!a || b.meeting_date > a.meeting_date ? b : a), null);
    // todayStart only changes with the calendar day, which a remount picks up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings]);

  // Get future meetings from both tables
  const allUpcomingMeetings = useMemo(() => {
    // Future meetings from meetings table (with agenda)
    const futureMeetings = meetings
      .filter(m => localDate(m.meeting_date) > todayStart)
      .map(m => ({
        id: m.id,
        date: m.meeting_date,
        venue: m.agenda,
        time: null as string | null,
        type: 'meeting' as const,
      }));

    // Scheduled upcoming meetings (with venue/time), except one already held today.
    const scheduled = upcomingMeetings
      .filter(m => m.meeting_date.slice(0, 10) !== lastMeeting?.meeting_date.slice(0, 10))
      .map(m => ({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetings, upcomingMeetings, lastMeeting]);

  // What happened at the last meeting: the same record the Meetings page shows and shares on
  // WhatsApp, so the figures always agree. record is null when it couldn't be loaded.
  const [lastRecord, setLastRecord] = useState<{ id: string; record: MeetingRecord | null } | null>(null);
  useEffect(() => {
    if (!lastMeeting) return;
    let cancelled = false;
    getMeetingRecord(lastMeeting)
      .then((record) => { if (!cancelled) setLastRecord({ id: lastMeeting.id, record }); })
      .catch(() => { if (!cancelled) setLastRecord({ id: lastMeeting.id, record: null }); });
    return () => { cancelled = true; };
  }, [lastMeeting]);
  const lastLoaded = lastMeeting !== null && lastRecord?.id === lastMeeting.id;
  const last = lastLoaded ? lastRecord.record : null;
  // Members (of those who had joined by the meeting) with savings recorded at it.
  const savedCount = last ? last.savings.filter(s => Number(s.amount) > 0).length : 0;

  // Calculate total members
  const totalMembers = useMemo(() => {
    return members.length;
  }, [members]);

  // Total Budget: the money in the bank account (see hooks/useTotalBudget.ts).
  const { totalBudget, isLoading: budgetLoading } = useTotalBudget();

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

  // Active loans for the register: overdue ones first, then by the date they fall due.
  const activeLoanRows = loans
    .filter(loan => loan.status === "active")
    .map(loan => ({ ...loan, due: loanDueDate(loan.loan_date), overdue: isOverdue(loan) }))
    .sort((a, b) => (a.overdue === b.overdue ? a.due.localeCompare(b.due) : a.overdue ? -1 : 1));

  // Aggregate budget contributions by month-year
  const budgetData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    // Balances brought forward from the paper registers are not a month's contributions.
    contributions.filter((c) => !c.is_opening).forEach((contribution) => {
      const date = new Date(contribution.contribution_date);
      const monthKey = format(date, "yyyy-MM");
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + contribution.amount;
    });
    return Object.entries(monthlyData)
      .map(([key, budget]) => ({
        key,
        month: format(new Date(key + "-01"), "MMM yy"),
        budget,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [contributions]);

  // Aggregate loan issued by month-year
  const loanIssuedData = useMemo(() => {
    const monthlyData: { [key: string]: number } = {};
    // Loans brought in from the paper registers were lent before the cut-over; their repayments up
    // to then are in the registers too, so neither side belongs on the app's monthly trend.
    loans.filter((loan) => !loan.opening_as_at).forEach((loan) => {
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
      .map((key) => ({
        key,
        month: format(new Date(key + "-01"), "MMM yy"),
        issued: loanIssuedData[key] || 0,
        recovered: loanRecoveredData[key] || 0,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [loanIssuedData, loanRecoveredData]);

  const budgetTicks = niceTicks(Math.max(0, ...budgetData.map(d => d.budget)));
  const loansTicks = niceTicks(Math.max(0, ...loansData.map(d => Math.max(d.issued, d.recovered))));

  const isLoading = membersLoading || meetingsLoading || loansLoading || contributionsLoading || reserveLoading;

  const today = useMemo(() => format(new Date(), "EEEE, dd MMMM yyyy"), []);
  const amount = (n: number) => Number(n).toLocaleString();

  const whenLabel = (date: string) => {
    const days = differenceInCalendarDays(localDate(date), todayStart);
    return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  };

  return (
    <div className="space-y-4">
      {/* Page Header — statement letterhead */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 border-b-2 border-accent/70 pb-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground mt-1">Dashboard</h2>
          <AmountsNote className="block" />
        </div>
        <p className="text-sm text-muted-foreground sm:text-right">
          {today}
          <span className="block text-xs">Mogh Students Organisation</span>
        </p>
      </div>

      <BackupReminder />

      {/* Stats Grid — printed summary slips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-4">
        <StatCard
          title="Total Members"
          value={isLoading ? "—" : totalMembers.toString()}
          icon={Users}
          iconColor="border-primary/40 bg-primary/10 text-primary"
        />
        <StatCard
          title="Total Budget"
          value={
            isLoading || budgetLoading ? "—" : totalBudget.toLocaleString()
          }
          note="In the bank account"
          icon={Wallet}
          iconColor="border-secondary/40 bg-secondary/10 text-secondary"
        />
        <StatCard
          title="Loans Outstanding"
          value={isLoading ? "—" : activeLoans.toLocaleString()}
          icon={HandCoins}
          iconColor="border-destructive/40 bg-destructive/10 text-destructive"
        />
        <StatCard
          title="Reserve Fund"
          value={isLoading ? "—" : reserveFund.toLocaleString()}
          icon={PiggyBank}
          iconColor="border-accent/60 bg-accent/15 text-accent-foreground dark:text-accent"
        />
        <StatCard
          title="Overdue Loans"
          value={
            isLoading
              ? "—"
              : `${loanStats.overdueCount} loan${loanStats.overdueCount === 1 ? "" : "s"} · ${loanStats.overdueAmount.toLocaleString()}`
          }
          icon={AlertTriangle}
          iconColor="border-destructive/40 bg-destructive/10 text-destructive"
        />
      </div>

      {/* Quick Info — the active loan book beside the meeting calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <Card className="shadow-sm rounded-sm flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 gap-3 px-5 py-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              Active Loans
              {!loansLoading && activeLoanRows.length > 0 && (
                <span className="figure text-xs font-normal text-muted-foreground">
                  {activeLoanRows.length}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-4">
              <Link
                to="/loans"
                className="flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loansLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Loading loans…
              </p>
            ) : activeLoanRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 px-5">Member</TableHead>
                    <TableHead className="h-9 px-3">Issued</TableHead>
                    <TableHead className="h-9 px-3">Due by</TableHead>
                    <TableHead className="h-9 px-5 text-right">
                      Outstanding
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLoanRows.slice(0, LOAN_ROWS).map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="px-3 py-2">
                        <p className="font-medium text-foreground truncate">
                          {loan.member_name || "Unknown member"}
                        </p>
                        <p className="figure text-xs text-muted-foreground">
                          {amount(loan.amount)}
                        </p>
                      </TableCell>
                      <TableCell className="figure px-3 py-2 text-muted-foreground">
                        {format(localDate(loan.loan_date), settings.dateFormat)}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <span
                          className={`figure ${loan.overdue ? "text-destructive font-semibold" : "text-foreground"}`}
                        >
                          {format(
                            parseLocalDate(loan.due),
                            settings.dateFormat,
                          )}
                        </span>
                        {loan.overdue && (
                          <Badge variant="destructive" className="ml-2">
                            Overdue
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <p className="figure font-semibold text-foreground whitespace-nowrap">
                          {amount(loan.remaining_amount)}
                        </p>
                        {Number(loan.penalty_total) > 0 && (
                          <p className="figure text-xs text-muted-foreground whitespace-nowrap">
                            incl. {amount(loan.penalty_total)} penalty
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center gap-3 px-5 py-5">
                <div className="w-9 h-9 rounded-sm border-2 border-border bg-muted flex items-center justify-center flex-shrink-0">
                  <HandCoins className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    No active loans
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Link
                      to="/loans"
                      className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                    >
                      Issue a loan from the Loans page
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          {activeLoanRows.length > LOAN_ROWS && (
            <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
              {activeLoanRows.length - LOAN_ROWS} more on the{" "}
              <Link
                to="/loans"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                Loans page
              </Link>
            </p>
          )}
        </Card>

        <Card className="shadow-sm rounded-sm flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 gap-3 px-5 py-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              Meetings
            </CardTitle>
            <div className="flex items-center gap-4">
              <Link
                to="/meetings"
                className="flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!meetingsLoading && (
              <p className="px-5 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Upcoming
              </p>
            )}
            {meetingsLoading ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Loading meetings…
              </p>
            ) : allUpcomingMeetings.length > 0 ? (
              <ul className="divide-y divide-border">
                {allUpcomingMeetings.slice(0, MEETING_ROWS).map((meeting) => {
                  const d = localDate(meeting.date);
                  const when = whenLabel(meeting.date);
                  return (
                    <li
                      key={meeting.id}
                      className="flex items-center gap-3 px-5 py-2.5"
                    >
                      <div className="w-10 h-10 rounded-sm border-2 border-primary/30 bg-primary/5 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="figure text-sm font-semibold leading-none text-foreground">
                          {format(d, "dd")}
                        </span>
                        <span className="tracked-label mt-0.5 text-[9px] font-semibold uppercase leading-none text-primary">
                          {format(d, "MMM")}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {meeting.venue || "TBD"}
                        </p>
                        <p className="figure flex flex-wrap gap-x-2 text-xs text-muted-foreground mt-0.5">
                          <span className="whitespace-nowrap">
                            {format(d, "EEE")} {format(d, settings.dateFormat)}
                          </span>
                          {meeting.time && (
                            <span className="whitespace-nowrap">
                              {formatTime(meeting.time, settings.timeFormat)}
                            </span>
                          )}
                        </p>
                      </div>
                      {when === "Today" ? (
                        <Badge className="flex-shrink-0">Today</Badge>
                      ) : (
                        <span className="flex-shrink-0 text-xs text-muted-foreground">
                          {when}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex items-center gap-3 px-5 py-5">
                <div className="w-9 h-9 rounded-sm border-2 border-border bg-muted flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    No upcoming meetings
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <Link
                      to="/meetings"
                      className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                    >
                      Schedule one from the Meetings page
                    </Link>
                  </p>
                </div>
              </div>
            )}
          </CardContent>
          {!meetingsLoading &&
            lastMeeting &&
            (() => {
              const d = localDate(lastMeeting.meeting_date);
              return (
                <div className="border-t border-border">
                  <div className="flex items-baseline justify-between gap-3 px-5 pt-2.5 pb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Last meeting
                    </p>
                    <p className="figure text-xs text-foreground whitespace-nowrap">
                      {format(d, "EEE")} {format(d, settings.dateFormat)}
                    </p>
                  </div>

                  {!lastLoaded ? (
                    <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                      Loading the meeting record…
                    </p>
                  ) : !last ? (
                    <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
                      Couldn't load this meeting's record. It's on the{" "}
                      <Link
                        to="/meetings"
                        className="text-primary underline underline-offset-4 hover:text-primary/80"
                      >
                        Meetings page
                      </Link>
                      .
                    </p>
                  ) : (
                    <>
                      {last.attendance.length > 0 ? (
                        <dl className="grid grid-cols-3 divide-x divide-border border-y border-border text-center">
                          <div className="py-2">
                            <dt className="text-[11px] text-muted-foreground">
                              Present
                            </dt>
                            <dd className="figure text-base font-semibold text-foreground">
                              {last.presentCount}
                            </dd>
                          </div>
                          <div className="py-2">
                            <dt className="text-[11px] text-muted-foreground">
                              On leave
                            </dt>
                            <dd className="figure text-base font-semibold text-foreground">
                              {last.onLeave.length}
                            </dd>
                          </div>
                          <div className="py-2">
                            <dt className="text-[11px] text-muted-foreground">
                              Absent
                            </dt>
                            <dd
                              className={`figure text-base font-semibold ${last.absent.length > 0 ? "text-destructive" : "text-foreground"}`}
                            >
                              {last.absent.length}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
                          No attendance recorded.
                        </p>
                      )}

                      <dl className="space-y-1 px-5 py-2.5 text-xs">
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">
                            {last.savings.length > 0 ? (
                              <>
                                Savings from{" "}
                                <span className="figure whitespace-nowrap">
                                  {savedCount} of {last.savings.length}
                                </span>
                              </>
                            ) : (
                              "Savings collected"
                            )}
                          </dt>
                          <dd className="figure font-semibold text-foreground whitespace-nowrap">
                            {amount(last.totals.savings)}
                          </dd>
                        </div>
                        {/* Loan repayments since the previous meeting, as on the Meetings page. */}
                        <div className="flex items-baseline justify-between gap-3">
                          <dt className="text-muted-foreground">
                            Loans collected
                          </dt>
                          <dd className="figure font-semibold text-foreground whitespace-nowrap">
                            {amount(last.totals.collected)}
                          </dd>
                        </div>
                      </dl>
                      <div className="flex items-baseline justify-between gap-3 border-t border-border px-5 py-2.5 text-xs">
                        <span className="font-semibold text-foreground">
                          Total{" "}
                          <span className="whitespace-nowrap">
                            (savings + loans)
                          </span>
                        </span>
                        <span className="figure text-sm font-bold text-primary whitespace-nowrap">
                          {amount(last.totals.totalCollected)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
        </Card>
      </div>

      {/* Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-sm rounded-sm">
          <CardHeader className="flex-row items-start justify-between gap-3 px-5 py-3 border-b border-border space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                Monthly Contributions
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Contributions collected each month
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-3 pb-3">
            {budgetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={budgetData}
                  margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    ticks={budgetTicks}
                    domain={[0, budgetTicks[budgetTicks.length - 1] || 1]}
                    tickFormatter={(v: number) => compact.format(v)}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }}
                    content={<ChartTooltip />}
                  />
                  <Bar
                    dataKey="budget"
                    fill="hsl(var(--primary))"
                    name="Contributions"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No data available yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link
                    to="/meetings"
                    className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                  >
                    Record a meeting to see this chart populate
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm rounded-sm">
          <CardHeader className="flex-row items-start justify-between gap-3 px-5 py-3 border-b border-border space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
               
                Monthly Loans
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Loans issued and repayments received each month
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5 pt-1">
              {loansData.length > 0 && (
                <ul
                  className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground"
                  aria-label="Chart legend"
                >
                  <li className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px] bg-[hsl(var(--chart-issued))]"
                      aria-hidden
                    />{" "}
                    Issued
                  </li>
                  <li className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px] bg-[hsl(var(--chart-recovered))]"
                      aria-hidden
                    />{" "}
                    Recovered
                  </li>
                </ul>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pt-3 pb-3">
            {loansData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={loansData}
                  barGap={2}
                  margin={{ top: 6, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    tick={axisTick}
                    tickLine={false}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    interval="preserveStartEnd"
                    minTickGap={18}
                  />
                  <YAxis
                    ticks={loansTicks}
                    domain={[0, loansTicks[loansTicks.length - 1] || 1]}
                    tickFormatter={(v: number) => compact.format(v)}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }}
                    content={<ChartTooltip />}
                  />
                  <Bar
                    dataKey="issued"
                    fill="hsl(var(--chart-issued))"
                    name="Loans issued"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={20}
                  />
                  <Bar
                    dataKey="recovered"
                    fill="hsl(var(--chart-recovered))"
                    name="Recovered"
                    radius={[2, 2, 0, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  No data available yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  <Link
                    to="/loans"
                    className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                  >
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

/** Chart hover card in the statement style: month, then each series with its figure. */
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">
        {payload[0]?.payload?.key ? format(new Date(payload[0].payload.key + "-01"), "MMMM yyyy") : label}
      </p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="mt-1 flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-[1px]" style={{ background: p.color }} aria-hidden />
          {p.name}
          <span className="figure ml-auto pl-4 font-semibold text-foreground">
            {Number(p.value).toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}
