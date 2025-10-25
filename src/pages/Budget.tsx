import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganization } from "@/contexts/OrganizationContext";
import { DollarSign, TrendingUp, Wallet, Users, Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Budget() {
  const { members, meetings, totalBudget, totalLoanCollected, totalLoanOutstanding } = useOrganization();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const itemsPerPage = 5;

  // Get latest meeting
  const latestMeeting = useMemo(() => {
    if (meetings.length === 0) return null;
    return meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [meetings]);

  // Calculate this month's total from latest meeting
  const thisMonthTotal = useMemo(() => {
    if (!latestMeeting) return 0;
    return latestMeeting.contributions.reduce((sum, c) => sum + c.amount, 0);
  }, [latestMeeting]);

  // Calculate member budgets
  const memberBudgets = useMemo(() => {
    const budgetMap = new Map<number, number>();
    
    meetings.forEach(meeting => {
      meeting.contributions.forEach(contrib => {
        const current = budgetMap.get(contrib.memberId) || 0;
        budgetMap.set(contrib.memberId, current + contrib.amount);
      });
    });

    return Array.from(budgetMap.entries())
      .map(([memberId, total]) => {
        const member = members.find(m => m.id === memberId);
        return {
          memberId,
          memberName: member?.name || 'Unknown',
          totalBudget: total
        };
      })
      .sort((a, b) => b.totalBudget - a.totalBudget);
  }, [meetings, members]);

  // Top 5 highest budgets
  const topFiveBudgets = useMemo(() => {
    return memberBudgets.slice(0, 5);
  }, [memberBudgets]);

  // Paginated member budgets
  const paginatedMembers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return memberBudgets.slice(startIndex, startIndex + itemsPerPage);
  }, [memberBudgets, currentPage]);

  const totalPages = Math.ceil(memberBudgets.length / itemsPerPage);

  // Get member contributions by month
  const getMemberMonthlyContributions = (memberId: number) => {
    const monthlyContribs = new Map<string, number>();
    
    meetings.forEach(meeting => {
      const contrib = meeting.contributions.find(c => c.memberId === memberId);
      if (contrib) {
        const month = new Date(meeting.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        const current = monthlyContribs.get(month) || 0;
        monthlyContribs.set(month, current + contrib.amount);
      }
    });

    return Array.from(monthlyContribs.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => b.month.localeCompare(a.month));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Monthly Budget</h2>
          <p className="text-muted-foreground mt-1">Track monthly contributions</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="This Month"
          value={`PKR ${thisMonthTotal.toLocaleString()}`}
          icon={DollarSign}
          trend={latestMeeting ? `Meeting on ${new Date(latestMeeting.date).toLocaleDateString()}` : 'No meeting yet'}
          trendUp={true}
        />
        <StatCard
          title="Total Loan Collected"
          value={`PKR ${totalLoanCollected.toLocaleString()}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Loan Outstanding"
          value={`PKR ${totalLoanOutstanding.toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard
          title="Total Organization Budget"
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
            <div className="space-y-4">
              {topFiveBudgets.map((member, index) => (
                <div key={member.memberId} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{member.memberName}</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-foreground">PKR {member.totalBudget.toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No contributions yet</p>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Member Contributions</CardTitle>
        </CardHeader>
        <CardContent>
          {memberBudgets.length > 0 ? (
            <>
              <div className="space-y-4">
                {paginatedMembers.map((member) => (
                  <div key={member.memberId} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-semibold text-foreground">{member.memberName}</p>
                        <p className="text-sm text-muted-foreground">Total Budget</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">PKR {member.totalBudget.toLocaleString()}</p>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedMember(selectedMember === member.memberId ? null : member.memberId)}
                        >
                          {selectedMember === member.memberId ? 'Hide' : 'View'} Monthly
                        </Button>
                      </div>
                    </div>
                    
                    {selectedMember === member.memberId && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <p className="font-semibold text-sm text-muted-foreground mb-2">Monthly Contributions:</p>
                        {getMemberMonthlyContributions(member.memberId).map((monthly) => (
                          <div key={monthly.month} className="flex justify-between items-center p-2 rounded bg-muted/50">
                            <span className="text-sm">{monthly.month}</span>
                            <Badge variant="secondary">PKR {monthly.amount.toLocaleString()}</Badge>
                          </div>
                        ))}
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
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">No contributions recorded yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
