import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMemo } from "react";

export default function Budget() {
  const { members, totalBudget } = useOrganization();

  // Calculate budget statistics from members
  const budgetStats = useMemo(() => {
    const allContributions = members.flatMap(m => m.monthlyContributions);
    const paidContributions = allContributions.filter(c => c.paid);
    
    const totalCollected = paidContributions.reduce((sum, c) => sum + c.amount, 0);
    const averagePerMember = members.length > 0 ? Math.floor(totalCollected / members.length) : 0;
    
    // Get current month contributions
    const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentMonthContributions = paidContributions.filter(c => c.month === currentMonth);
    const currentMonthTotal = currentMonthContributions.reduce((sum, c) => sum + c.amount, 0);
    const currentMonthMembers = new Set(
      members.filter(m => 
        m.monthlyContributions.some(c => c.month === currentMonth && c.paid)
      ).map(m => m.id)
    ).size;

    return {
      currentMonthTotal,
      currentMonthMembers,
      averagePerMember,
      totalCollected
    };
  }, [members]);

  // Group contributions by month for history
  const monthlyHistory = useMemo(() => {
    const monthMap = new Map<string, { total: number; memberIds: Set<number> }>();
    
    members.forEach(member => {
      member.monthlyContributions
        .filter(c => c.paid)
        .forEach(contribution => {
          if (!monthMap.has(contribution.month)) {
            monthMap.set(contribution.month, { total: 0, memberIds: new Set() });
          }
          const data = monthMap.get(contribution.month)!;
          data.total += contribution.amount;
          data.memberIds.add(member.id);
        });
    });

    return Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        collected: data.total,
        members: data.memberIds.size,
        status: "Completed"
      }))
      .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime());
  }, [members]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Monthly Budget</h2>
          <p className="text-muted-foreground mt-1">Track monthly contributions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR {budgetStats.currentMonthTotal.toLocaleString()}</p>
            <p className="text-sm text-secondary mt-2">{budgetStats.currentMonthMembers} members contributed</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Average/Member</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR {budgetStats.averagePerMember.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-2">All time</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Collected</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR {budgetStats.totalCollected.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-2">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Collection History</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No contribution history yet. Add members and record their contributions.</p>
          ) : (
            <div className="space-y-3">
              {monthlyHistory.map((data, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div>
                    <h3 className="font-semibold text-foreground">{data.month}</h3>
                    <p className="text-sm text-muted-foreground">{data.members} members</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">PKR {data.collected.toLocaleString()}</p>
                    <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary text-xs font-medium rounded-full">
                      {data.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
