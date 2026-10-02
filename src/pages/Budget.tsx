import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Building2, HandCoins, BarChart3 } from "lucide-react";
import { TablePager, usePaged } from "@/components/TablePager";
import { useMemo, useEffect } from "react";
import StatCard from "@/components/StatCard";
import ViewReportButton from "@/components/ViewReportButton";
import { thisYearToDate } from "@/utils/accounting";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useSettings } from "@/contexts/SettingsContext";
import { useMembers } from "@/hooks/useMembers";
import { useContributions } from "@/hooks/useContributions";
import { useMeetings } from "@/hooks/useMeetings";
import { useLoans } from "@/hooks/useLoans";
import { onMeetingSaved } from "@/lib/events";
import { useTotalBudget } from "@/hooks/useTotalBudget";
import { useLocation } from "react-router-dom";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const axisTick = { fontSize: 11, fontFamily: "IBM Plex Mono", fill: "hsl(var(--muted-foreground))" };

export default function Budget() {
  const { members, isLoading: membersLoading } = useMembers();
  const { contributions, isLoading: contributionsLoading, fetchContributions } = useContributions();
  const { meetings, isLoading: meetingsLoading, fetchMeetings } = useMeetings();
  const { installments, isLoading: loansLoading } = useLoans();
  const { settings } = useSettings();
  const location = useLocation();
  const isLoading = membersLoading || contributionsLoading || meetingsLoading || loansLoading;

  // Refetch every time user navigates to this page (works in Electron's single window)
  useEffect(() => {
    fetchMeetings();
    fetchContributions();
  }, [location.pathname]);

  // Also refetch immediately when a meeting is saved from the Meetings page
  useEffect(() => {
    return onMeetingSaved(() => {
      fetchMeetings();
      fetchContributions();
    });
  }, []);

  // Total Budget: the money in the bank account (see hooks/useTotalBudget.ts).
  const { totalBudget, isLoading: budgetLoading } = useTotalBudget();

  // Always the most recent meeting by date — every "latest meeting" figure below tracks it.
  const latestMeeting = useMemo(() => {
    if (!meetings.length) return null;
    return [...meetings].sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime())[0];
  }, [meetings]);

  const latestMeetingContributions = useMemo(() => {
    if (!latestMeeting) return [];
    return contributions.filter(c => c.meeting_id === latestMeeting.id);
  }, [latestMeeting, contributions]);

  const latestMeetingTotal = useMemo(() =>
    latestMeetingContributions.reduce((s, c) => s + c.amount, 0),
    [latestMeetingContributions]
  );

  const contributionsPaged = usePaged(latestMeetingContributions, latestMeeting?.id ?? null);

  // Loan installments have no meeting_id, only a payment date — members pay both their
  // contribution and any loan installment on meeting day, so same-date installments are
  // what was collected "at" the latest meeting.
  const latestMeetingLoanCollected = useMemo(() => {
    if (!latestMeeting) return 0;
    return installments
      .filter((i) => i.payment_date === latestMeeting.meeting_date)
      .reduce((s, i) => s + i.amount, 0);
  }, [installments, latestMeeting]);

  const isLatestMeetingToday = useMemo(() => {
    if (!latestMeeting) return false;
    return latestMeeting.meeting_date === format(new Date(), "yyyy-MM-dd");
  }, [latestMeeting]);

  const monthlyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    // Balances brought forward from the paper registers are not a month's contributions.
    contributions.filter((c) => !c.is_opening).forEach((c) => {
      const key = format(new Date(c.contribution_date), "yyyy-MM");
      map[key] = (map[key] || 0) + c.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month: format(new Date(month + "-01"), "MMM yy"), total }));
  }, [contributions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-accent/70 pb-4">
        <div>
          <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Contribution Ledger</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Monthly Budget</h2>
          <p className="text-sm text-muted-foreground mt-0.5">The fund's running total and the latest meeting's collection</p>
        </div>
        <ViewReportButton request={{ kind: "contribution-register", period: thisYearToDate() }} label="Contribution Register" size="default" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Budget"
          value={isLoading || budgetLoading ? "—" : `${settings.currency} ${totalBudget.toLocaleString()}`}
          note="In the bank account"
          icon={Building2}
          iconColor="border-primary/40 bg-primary/10 text-primary"
        />
        <StatCard
          title={isLatestMeetingToday ? "Today's Meeting Total" : "Latest Meeting Total"}
          value={isLoading ? "—" : `${settings.currency} ${latestMeetingTotal.toLocaleString()}`}
          icon={DollarSign}
          iconColor="border-accent/60 bg-accent/15 text-accent-foreground dark:text-accent"
          note={latestMeeting ? `Savings collected on ${format(new Date(latestMeeting.meeting_date), settings.dateFormat)}` : "No meeting yet"}
        />
        <StatCard
          title="Loans Collected"
          value={isLoading ? "—" : `${settings.currency} ${latestMeetingLoanCollected.toLocaleString()}`}
          icon={HandCoins}
          iconColor="border-secondary/40 bg-secondary/10 text-secondary"
          note={latestMeeting ? "Loan repayments at the same meeting" : "No meeting yet"}
        />
      </div>

      {/* The latest meeting's contributions beside the monthly trend: a member / amount list
          doesn't need the full width. Both cards take the row's height; the chart fills its card. */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="shadow-sm rounded-sm flex flex-col lg:col-span-2">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                Members Contributions
              </div>
            </CardTitle>
            <CardDescription className="text-xs">Each member's contribution at the latest meeting</CardDescription>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {!latestMeeting ? (
              <p className="text-center text-muted-foreground py-6 text-xs">No meeting recorded yet</p>
            ) : latestMeetingContributions.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-xs">No contributions recorded for this meeting</p>
            ) : (
              <div className="divide-y divide-border/50">
                <div className="grid grid-cols-12 px-4 py-1.5 bg-muted/50">
                  <span className="col-span-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
                  <span className="col-span-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                </div>
                {contributionsPaged.rows.map((c) => {
                  const member = members.find(m => m.id === c.member_id);
                  return (
                    <div key={c.id} className="grid grid-cols-12 px-4 py-1.5 items-center hover:bg-muted/30 transition-colors">
                      <span className="col-span-8 truncate pr-2 text-xs font-medium text-foreground">{member?.name || "Unknown"}</span>
                      <span className="figure col-span-4 text-xs font-bold text-foreground text-right whitespace-nowrap">{settings.currency} {c.amount.toLocaleString()}</span>
                    </div>
                  );
                })}
                <TablePager paged={contributionsPaged} noun="contributions" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card className="shadow-sm rounded-sm flex flex-col lg:col-span-3">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              Monthly Contributions
            </CardTitle>
            <CardDescription className="text-xs">Contributions collected each month</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col px-3 pt-3 pb-3">
            {monthlyTrend.length > 0 ? (
              // Absolutely placed so the chart takes the height the row gives it without adding to it.
              <div className="relative min-h-[240px] flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyTrend} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} interval="preserveStartEnd" minTickGap={18} />
                      <YAxis tickFormatter={(v: number) => compact.format(v)} tick={axisTick} tickLine={false} axisLine={false} width={44} />
                      <Tooltip cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.6 }} formatter={(value) => `${settings.currency} ${Number(value).toLocaleString()}`} />
                      <Bar dataKey="total" fill="hsl(var(--primary))" name="Collected" radius={[2, 2, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8 text-sm">No contributions recorded yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
