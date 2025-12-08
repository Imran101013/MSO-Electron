import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DollarSign, TrendingUp, Wallet, Users, Building2 } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsContext";

export default function Budget() {
  const {
    members,
    meetings,
    totalBudget,
    totalLoanInstallmentCollected,
    totalLoanOutstanding,
  } = useOrganization();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const itemsPerPage = 5;

  // Get latest meeting (non-mutating) — compute inline so it updates whenever `meetings` changes
  const latestMeeting =
    meetings.length === 0
      ? null
      : meetings.reduce((a, b) =>
          new Date(a.date) > new Date(b.date) ? a : b
        );

  // Calculate this month's total from latest meeting
  const thisMonthTotal = useMemo(() => {
    if (!latestMeeting) return 0;
    return latestMeeting.contributions.reduce((sum, c) => sum + c.amount, 0);
  }, [latestMeeting]);

  // Calculate member budgets from latest meeting only
  const memberBudgets = useMemo(() => {
    if (!latestMeeting) return [];

    return latestMeeting.contributions
      .map((contrib) => {
        const member = members.find((m) => m.id === contrib.memberId);
        return {
          memberId: contrib.memberId,
          memberName: member?.name || "Unknown",
          totalBudget: contrib.amount,
        };
      })
      .sort((a, b) => b.totalBudget - a.totalBudget);
  }, [latestMeeting, members]);

  // Top 5 highest contributions from latest meeting
  const topFiveBudgets = useMemo(() => {
    if (!latestMeeting || latestMeeting.contributions.length === 0) {
      return [];
    }

    return latestMeeting.contributions
      .map((contrib) => {
        const member = members.find((m) => m.id === contrib.memberId);
        return {
          memberId: contrib.memberId,
          memberName: member?.name || "Unknown",
          totalBudget: contrib.amount,
        };
      })
      .sort((a, b) => b.totalBudget - a.totalBudget)
      .slice(0, 5);
  }, [latestMeeting, members]);

  // Paginated member budgets
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return memberBudgets.slice(startIndex, startIndex + itemsPerPage);
  }, [memberBudgets, currentPage]);

  const totalPages = Math.ceil(memberBudgets.length / itemsPerPage);

  // Get member contribution from latest meeting
  const getMemberLatestContribution = (memberId: number) => {
    if (!latestMeeting) return null;

    const contrib = latestMeeting.contributions.find(
      (c) => c.memberId === memberId
    );

    return contrib ? contrib.amount : null;
  };

  // Reset pagination/selection when a new meeting (by date) appears
  useEffect(() => {
    setCurrentPage(1);
    setSelectedMember(null);
  }, [latestMeeting?.date]);

  const { settings } = useSettings();

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
          value={`PKR ${thisMonthTotal.toLocaleString()}`}
          icon={DollarSign}
          trend={
            latestMeeting
              ? `Meeting on ${format(
                  new Date(latestMeeting.date),
                  settings.dateFormat
                )}`
              : "No meeting yet"
          }
          trendUp={true}
        />
        <StatCard
          title="Total Loan Collected"
          value={`PKR ${totalLoanInstallmentCollected.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Loan Outstanding"
          value={`PKR ${totalLoanOutstanding.toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard
          title="Total Budget"
          value={`PKR ${totalBudget.toLocaleString()}`}
          icon={Building2}
        />
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Top 5 Highest Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          {topFiveBudgets.length > 0 ? (
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
          {memberBudgets.length > 0 ? (
            <>
              <div>
                {paginatedMembers.map((member) => (
                  <div key={member.memberId} className="border-b px-2 pb-2">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-semibold text-foreground">
                          {member.memberName}
                        </p>
                        {/* <p className="text-sm text-muted-foreground">
                          Budget Today
                        </p> */}
                      </div>
                      <div className="flex text-center">
                        <p className="text-sm font-semibold pt-1 text-foreground">
                          PKR {member.totalBudget.toLocaleString()}
                        </p>
                        {latestMeeting && (
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
                        )}
                      </div>
                    </div>

                    {selectedMember === member.memberId && (
                      <div className="mt-2 pt-2 border-t space-y-2">
                        <p className="font-semibold text-sm text-muted-foreground mb-2">
                          Meeting Details:
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
                            {meetings
                              .filter((meeting) =>
                                meeting.contributions.some(
                                  (c) => c.memberId === member.memberId
                                )
                              )
                              .map((meeting) => {
                                const contribution = meeting.contributions.find(
                                  (c) => c.memberId === member.memberId
                                );
                                if (!contribution) return null;
                                return (
                                  <tr
                                    key={meeting.id}
                                    className="border-b border-muted">
                                    <td className="p-2 text-sm">
                                      {format(
                                        new Date(meeting.date),
                                        settings.dateFormat
                                      )}
                                    </td>
                                    <td className="p-2 text-sm">
                                      PKR {contribution.amount.toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })}
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
