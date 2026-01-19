import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Wallet, Building2 } from "lucide-react";
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

export default function Budget() {
  const { members, isLoading: membersLoading } = useMembers();
  const { contributions, isLoading: contributionsLoading } = useContributions();
  const { loans, isLoading: loansLoading } = useLoans();
  const { meetings, isLoading: meetingsLoading } = useMeetings();
  const { settings } = useSettings();

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const itemsPerPage = 5;

  const isLoading = membersLoading || contributionsLoading || loansLoading || meetingsLoading;

  // Calculate total budget from all contributions
  const totalBudget = useMemo(() => {
    return contributions.reduce((sum, c) => sum + c.amount, 0);
  }, [contributions]);

  // Calculate total loan collected (from installments - sum of paid amounts)
  const totalLoanCollected = useMemo(() => {
    return loans.reduce((sum, loan) => {
      const paidAmount = loan.amount - loan.remaining_amount;
      return sum + paidAmount;
    }, 0);
  }, [loans]);

  // Calculate total loan outstanding
  const totalLoanOutstanding = useMemo(() => {
    return loans
      .filter(loan => loan.status === "active")
      .reduce((sum, loan) => sum + loan.remaining_amount, 0);
  }, [loans]);

  // Get latest meeting with contributions
  const latestMeetingWithContributions = useMemo(() => {
    if (meetings.length === 0) return null;
    
    // Sort meetings by date descending
    const sortedMeetings = [...meetings].sort(
      (a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
    );

    // Find the first meeting that has contributions
    for (const meeting of sortedMeetings) {
      const meetingContributions = contributions.filter(c => c.meeting_id === meeting.id);
      if (meetingContributions.length > 0) {
        return {
          ...meeting,
          contributions: meetingContributions,
        };
      }
    }

    // Return latest meeting even if no contributions
    return {
      ...sortedMeetings[0],
      contributions: contributions.filter(c => c.meeting_id === sortedMeetings[0].id),
    };
  }, [meetings, contributions]);

  // Calculate this month's total from latest meeting
  const thisMonthTotal = useMemo(() => {
    if (!latestMeetingWithContributions) return 0;
    return latestMeetingWithContributions.contributions.reduce((sum, c) => sum + c.amount, 0);
  }, [latestMeetingWithContributions]);

  // Calculate member budgets with total contributions
  const memberBudgets = useMemo(() => {
    const budgetMap: { [key: string]: { memberId: string; memberName: string; totalBudget: number } } = {};

    contributions.forEach((contrib) => {
      const member = members.find((m) => m.id === contrib.member_id);
      if (!budgetMap[contrib.member_id]) {
        budgetMap[contrib.member_id] = {
          memberId: contrib.member_id,
          memberName: member?.name || "Unknown",
          totalBudget: 0,
        };
      }
      budgetMap[contrib.member_id].totalBudget += contrib.amount;
    });

    return Object.values(budgetMap).sort((a, b) => b.totalBudget - a.totalBudget);
  }, [contributions, members]);

  // Top 5 highest total contributors
  const topFiveBudgets = useMemo(() => {
    return memberBudgets.slice(0, 5);
  }, [memberBudgets]);

  // Paginated member budgets
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return memberBudgets.slice(startIndex, startIndex + itemsPerPage);
  }, [memberBudgets, currentPage]);

  const totalPages = Math.ceil(memberBudgets.length / itemsPerPage);

  // Get member contribution history
  const getMemberContributionHistory = (memberId: string) => {
    return contributions
      .filter((c) => c.member_id === memberId)
      .map((c) => {
        const meeting = meetings.find((m) => m.id === c.meeting_id);
        return {
          id: c.id,
          date: c.contribution_date,
          meetingDate: meeting?.meeting_date || c.contribution_date,
          amount: c.amount,
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Reset pagination/selection when contributions change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMember(null);
  }, [contributions.length]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">Monthly Budget</h2>
          <p className="text-muted-foreground mt-1">
            Track monthly contributions
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="This Month"
          value={isLoading ? "..." : `PKR ${thisMonthTotal.toLocaleString()}`}
          icon={DollarSign}
          trend={
            latestMeetingWithContributions
              ? `Meeting on ${format(
                  new Date(latestMeetingWithContributions.meeting_date),
                  settings.dateFormat
                )}`
              : "No meeting yet"
          }
          trendUp={true}
        />
        <StatCard
          title="Total Loan Collected"
          value={isLoading ? "..." : `PKR ${totalLoanCollected.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Loan Outstanding"
          value={isLoading ? "..." : `PKR ${totalLoanOutstanding.toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard
          title="Total Budget"
          value={isLoading ? "..." : `PKR ${totalBudget.toLocaleString()}`}
          icon={Building2}
        />
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Top 5 Highest Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : topFiveBudgets.length > 0 ? (
            <div>
              {topFiveBudgets.map((member, index) => (
                <div
                  key={member.memberId}
                  className="flex items-center justify-between border-b p-1 bg-muted/50">
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full flex items-center justify-center text-sm-primary font-semibold">
                      {index + 1}-
                    </div>
                    <div>
                      <p className="font-semibold text-medium">
                        {member.memberName}
                      </p>
                    </div>
                  </div>
                  <p className="text-medium font-semibold text-sm">
                    PKR {member.totalBudget.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No contributions yet
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>All Members Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : memberBudgets.length > 0 ? (
            <>
              <div>
                {paginatedMembers.map((member) => (
                  <div key={member.memberId} className="border-b px-2 pb-2">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-semibold text-foreground">
                          {member.memberName}
                        </p>
                      </div>
                      <div className="flex text-center">
                        <p className="text-sm font-semibold pt-1 text-foreground">
                          PKR {member.totalBudget.toLocaleString()}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedMember(
                              selectedMember === member.memberId
                                ? null
                                : member.memberId
                            )
                          }>
                          {selectedMember === member.memberId
                            ? "Hide"
                            : "View"}{" "}
                          Details
                        </Button>
                      </div>
                    </div>

                    {selectedMember === member.memberId && (
                      <div className="mt-2 pt-2 border-t space-y-2">
                        <p className="font-semibold text-sm text-muted-foreground mb-2">
                          Contribution History:
                        </p>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="p-2 text-sm font-semibold border border-muted">
                                Date
                              </th>
                              <th className="p-2 text-sm font-semibold border border-muted">
                                Contribution
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getMemberContributionHistory(member.memberId).map(
                              (contrib) => (
                                <tr
                                  key={contrib.id}
                                  className="border-b border-muted">
                                  <td className="p-2 text-sm">
                                    {format(
                                      new Date(contrib.date),
                                      settings.dateFormat
                                    )}
                                  </td>
                                  <td className="p-2 text-sm">
                                    PKR {contrib.amount.toLocaleString()}
                                  </td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No contributions recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
