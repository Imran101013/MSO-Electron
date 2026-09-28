import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Building2, HandCoins, BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import ViewReportButton from "@/components/ViewReportButton";
import { Button } from "@/components/ui/button";
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
import { useLocation } from "react-router-dom";

export default function Budget() {
  const { members, isLoading: membersLoading } = useMembers();
  const { contributions, isLoading: contributionsLoading, fetchContributions } = useContributions();
  const { meetings, isLoading: meetingsLoading, fetchMeetings } = useMeetings();
  const { installments, isLoading: loansLoading } = useLoans();
  const { settings } = useSettings();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
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

  // Each member's total_budget already includes both their monthly contributions and
  // their ratio share of any past profit distribution (useProfitDistributions bumps it
  // alongside the allocation row), so summing it here — rather than summing
  // contributions alone — is what actually reflects the organization's total fund.
  const totalBudget = useMemo(() => members.reduce((s, m) => s + m.total_budget, 0), [members]);

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

  const pageSize = Math.max(1, settings.itemsPerPage || 10);
  const totalPages = Math.max(1, Math.ceil(latestMeetingContributions.length / pageSize));
  const paginatedContributions = useMemo(
    () => latestMeetingContributions.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [latestMeetingContributions, currentPage, pageSize]
  );

  useEffect(() => { setCurrentPage(1); }, [latestMeeting?.id, pageSize]);

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
    contributions.forEach((c) => {
      const key = format(new Date(c.contribution_date), "yyyy-MM");
      map[key] = (map[key] || 0) + c.amount;
    });
    return Object.entries(map)
      .map(([month, total]) => ({ month: format(new Date(month + "-01"), "MMM yyyy"), total }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [contributions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-primary/40 pb-4">
        <div>
          <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Contribution Ledger</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Monthly Budget</h2>
          <p className="text-sm text-muted-foreground mt-0.5">The fund's running total and the latest meeting's collection</p>
        </div>
        <ViewReportButton request={{ kind: "contribution-register" }} label="Contribution Register" size="default" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Budget"
          value={isLoading ? "—" : `${settings.currency} ${totalBudget.toLocaleString()}`}
          icon={Building2}
          iconColor="border-primary/40 bg-primary/10 text-primary"
        />
        <StatCard
          title={isLatestMeetingToday ? "Today's Meeting Total" : "Latest Meeting Total"}
          value={isLoading ? "—" : `${settings.currency} ${latestMeetingTotal.toLocaleString()}`}
          icon={DollarSign}
          iconColor="border-accent/50 bg-accent/15 text-accent-foreground"
          trend={latestMeeting ? format(new Date(latestMeeting.meeting_date), settings.dateFormat) : "No meeting yet"}
          trendUp
        />
        <StatCard
          title="Loans Collected"
          value={isLoading ? "—" : `${settings.currency} ${latestMeetingLoanCollected.toLocaleString()}`}
          icon={HandCoins}
          iconColor="border-secondary/40 bg-secondary/10 text-secondary"
          trend={latestMeeting ? format(new Date(latestMeeting.meeting_date), settings.dateFormat) : "No meeting yet"}
          trendUp
        />
      </div>

      {/* Members Contributions — minimal, dense ledger row */}
      <Card className="shadow-sm rounded-sm">
        <CardHeader className="py-3 border-b border-border">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5 text-primary" />
              </div>
              Members Contributions
            </div>
            {latestMeeting && (
              <Badge variant="outline" className="figure font-normal text-[10px] px-1.5 py-0">
                {format(new Date(latestMeeting.meeting_date), settings.dateFormat)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
              {paginatedContributions.map((c) => {
                const member = members.find(m => m.id === c.member_id);
                return (
                  <div key={c.id} className="grid grid-cols-12 px-4 py-1.5 items-center hover:bg-muted/30 transition-colors">
                    <span className="col-span-8 text-xs font-medium text-foreground">{member?.name || "Unknown"}</span>
                    <span className="figure col-span-4 text-xs font-bold text-foreground text-right">{settings.currency} {c.amount.toLocaleString()}</span>
                  </div>
                );
              })}
              <div className="grid grid-cols-12 px-4 py-1.5 bg-muted/40 border-t border-border/60">
                <span className="col-span-8 text-[10px] font-semibold text-muted-foreground">Total</span>
                <span className="figure col-span-4 text-xs font-bold text-foreground text-right">{settings.currency} {latestMeetingTotal.toLocaleString()}</span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-2 border-t border-border/60">
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-3 h-3 mr-1" /> Previous
                  </Button>
                  <span className="figure text-[10px] text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    Next <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card className="shadow-sm rounded-sm">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            Monthly Contribution Trend
          </CardTitle>
          <CardDescription className="text-xs">Total collected per cycle over time</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyTrend} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                <Tooltip formatter={(value) => `${settings.currency} ${Number(value).toLocaleString()}`} />
                <Bar dataKey="total" fill="hsl(var(--primary))" name="Collected" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8 text-sm">No contributions recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
