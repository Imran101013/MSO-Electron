import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useMemo } from "react";

export default function Loans() {
  const { members, activeLoans } = useOrganization();

  // Get all active loans with member details
  const activeLoansList = useMemo(() => {
    const loans: Array<{
      id: number;
      memberId: number;
      memberName: string;
      amount: number;
      remaining: number;
      date: string;
    }> = [];

    members.forEach(member => {
      member.loans
        .filter(loan => loan.status === "Active")
        .forEach(loan => {
          loans.push({
            id: loan.id,
            memberId: member.id,
            memberName: member.name,
            amount: loan.amount,
            remaining: loan.remainingAmount,
            date: loan.date
          });
        });
    });

    return loans;
  }, [members]);

  const loanStats = useMemo(() => {
    const totalOutstanding = activeLoans;
    const activeLoanCount = activeLoansList.length;
    const membersWithLoans = new Set(activeLoansList.map(l => l.memberId)).size;

    return {
      totalOutstanding,
      activeLoanCount,
      membersWithLoans
    };
  }, [activeLoans, activeLoansList]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Loan Management</h2>
          <p className="text-muted-foreground mt-1">Track and manage member loans</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold text-foreground">PKR {loanStats.totalOutstanding.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-3xl font-bold text-foreground mt-2">{loanStats.activeLoanCount}</p>
            <p className="text-sm text-muted-foreground mt-2">{loanStats.membersWithLoans} members with loans</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Average Loan</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              PKR {loanStats.activeLoanCount > 0 ? Math.floor(loanStats.totalOutstanding / loanStats.activeLoanCount).toLocaleString() : 0}
            </p>
            <p className="text-sm text-secondary mt-2">Per active loan</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Active Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {activeLoansList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No active loans. Loan management can be done from member details.</p>
          ) : (
            <div className="space-y-4">
              {activeLoansList.map((loan) => (
                <div 
                  key={`${loan.memberId}-${loan.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{loan.memberName}</h3>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Amount</p>
                        <p className="font-medium text-foreground">PKR {loan.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-medium text-destructive">PKR {loan.remaining.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Issue Date</p>
                        <p className="font-medium text-foreground">{new Date(loan.date).toLocaleDateString()}</p>
                      </div>
                    </div>
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
