import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Wallet, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";
import { useMembers } from "@/hooks/useMembers";
import { useContributions } from "@/hooks/useContributions";
import { useLoans } from "@/hooks/useLoans";
import { useMeetings } from "@/hooks/useMeetings";
import { cn } from "@/lib/utils";
import { onMeetingSaved } from "@/lib/events";
import { useLocation } from "react-router-dom";

export default function Budget() {
  const { members, isLoading: membersLoading } = useMembers();
  const { contributions, isLoading: contributionsLoading, fetchContributions } = useContributions();
  const { loans, isLoading: loansLoading } = useLoans();
  const { meetings, isLoading: meetingsLoading, fetchMeetings } = useMeetings();
  const { settings } = useSettings();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const itemsPerPage = settings.itemsPerPage;
  const isLoading = membersLoading || contributionsLoading || loansLoading || meetingsLoading;

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

  const totalBudget = useMemo(() => contributions.reduce((s, c) => s + c.amount, 0), [contributions]);
  const totalLoanCollected = useMemo(() => loans.reduce((s, l) => s + (l.amount - l.remaining_amount), 0), [loans]);
  const totalLoanOutstanding = useMemo(() => loans.filter(l => l.status === "active").reduce((s, l) => s + l.remaining_amount, 0), [loans]);

  // Always use the most recent meeting by date, show all its contributions
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

  const memberBudgets = useMemo(() => {
    const map: Record<string, { memberId: string; memberName: string; totalBudget: number }> = {};
    contributions.forEach((c) => {
      const member = members.find((m) => m.id === c.member_id);
      if (!map[c.member_id]) map[c.member_id] = { memberId: c.member_id, memberName: member?.name || "Unknown", totalBudget: 0 };
      map[c.member_id].totalBudget += c.amount;
    });
    return Object.values(map).sort((a, b) => b.totalBudget - a.totalBudget);
  }, [contributions, members]);

  const topFive = useMemo(() => memberBudgets.slice(0, 5), [memberBudgets]);
  const paginatedMembers = useMemo(() => memberBudgets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [memberBudgets, currentPage]);
  const totalPages = Math.ceil(memberBudgets.length / itemsPerPage);

  const getMemberHistory = (memberId: string) =>
    contributions.filter((c) => c.member_id === memberId)
      .map((c) => ({ id: c.id, date: c.contribution_date, amount: c.amount }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  useEffect(() => { setCurrentPage(1); setSelectedMember(null); }, [contributions.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
          <Wallet className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Monthly Budget</h2>
          <p className="text-sm text-muted-foreground">Track monthly contributions and loan activity</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Latest Meeting"
          value={isLoading ? "—" : `PKR ${latestMeetingTotal.toLocaleString()}`}
          icon={DollarSign}
          trend={latestMeeting ? `${format(new Date(latestMeeting.meeting_date), settings.dateFormat)} · ${latestMeetingContributions.length} contributions` : "No meeting yet"}
          trendUp
        />
        <StatCard title="Loan Collected" value={isLoading ? "—" : `PKR ${totalLoanCollected.toLocaleString()}`} icon={TrendingUp} iconColor="bg-emerald-500" />
        <StatCard title="Loan Outstanding" value={isLoading ? "—" : `PKR ${totalLoanOutstanding.toLocaleString()}`} icon={Wallet} iconColor="bg-rose-500" />
        <StatCard title="Total Budget" value={isLoading ? "—" : `PKR ${totalBudget.toLocaleString()}`} icon={Building2} iconColor="bg-gradient-secondary" />
      </div>

      {/* Latest Meeting Breakdown */}
      {latestMeeting && (
        <Card className="shadow-md border-0 card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
                Latest Meeting Contributions
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-normal">
                {format(new Date(latestMeeting.meeting_date), settings.dateFormat)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {latestMeetingContributions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">No contributions recorded for this meeting</p>
            ) : (
              <div className="divide-y divide-border/60">
                <div className="grid grid-cols-12 px-5 py-2.5 bg-muted/50">
                  <span className="col-span-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
                  <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                </div>
                {latestMeetingContributions.map((c) => {
                  const member = members.find(m => m.id === c.member_id);
                  return (
                    <div key={c.id} className="grid grid-cols-12 px-5 py-3 items-center hover:bg-muted/30 transition-colors">
                      <span className="col-span-8 text-sm font-medium text-foreground">{member?.name || "Unknown"}</span>
                      <span className="col-span-4 text-sm font-bold text-foreground text-right">PKR {c.amount.toLocaleString()}</span>
                    </div>
                  );
                })}
                <div className="grid grid-cols-12 px-5 py-3 bg-muted/40 border-t border-border/60">
                  <span className="col-span-8 text-xs font-semibold text-muted-foreground">Total</span>
                  <span className="col-span-4 text-sm font-bold text-foreground text-right">PKR {latestMeetingTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top 5 */}
      <Card className="shadow-md border-0 card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            Top 5 Highest Contributors
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>
            : topFive.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No contributions yet</p>
            : (
              <div className="divide-y divide-border/60">
                {topFive.map((m, i) => (
                  <div key={m.memberId} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white", i === 0 ? "bg-amber-500" : i === 1 ? "bg-slate-400" : i === 2 ? "bg-orange-400" : "bg-muted-foreground/40")}>
                        {i + 1}
                      </span>
                      <p className="font-semibold text-sm text-foreground">{m.memberName}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground">PKR {m.totalBudget.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
        </CardContent>
      </Card>

      {/* All Members */}
      <Card className="shadow-md border-0 card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              All Members Contributions
            </div>
            {memberBudgets.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-normal">{memberBudgets.length} members</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>
            : memberBudgets.length === 0 ? <p className="text-center text-muted-foreground py-8 text-sm">No contributions recorded yet</p>
            : (
              <>
                <div className="divide-y divide-border/60">
                  {paginatedMembers.map((member) => (
                    <div key={member.memberId}>
                      <div className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                        <p className="font-semibold text-sm text-foreground">{member.memberName}</p>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-bold text-foreground">PKR {member.totalBudget.toLocaleString()}</p>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                            onClick={() => setSelectedMember(selectedMember === member.memberId ? null : member.memberId)}>
                            {selectedMember === member.memberId ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Details</>}
                          </Button>
                        </div>
                      </div>
                      {selectedMember === member.memberId && (
                        <div className="px-5 pb-4 bg-muted/20">
                          <div className="grid grid-cols-12 py-2 border-b border-border/60">
                            <span className="col-span-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
                            <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
                          </div>
                          {getMemberHistory(member.memberId).map((c) => (
                            <div key={c.id} className="grid grid-cols-12 py-2 border-b border-border/40 last:border-0">
                              <span className="col-span-8 text-sm text-muted-foreground">{format(new Date(c.date), settings.dateFormat)}</span>
                              <span className="col-span-4 text-sm font-semibold text-foreground text-right">PKR {c.amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border/60">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
