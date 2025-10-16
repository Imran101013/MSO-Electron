import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const activeLoans = [
  { id: 1, member: "Muhammad Ahmed", amount: "PKR 100,000", remaining: "PKR 60,000", installment: "PKR 10,000", dueDate: "Mar 20, 2025" },
  { id: 2, member: "Ali Hassan", amount: "PKR 80,000", remaining: "PKR 40,000", installment: "PKR 8,000", dueDate: "Mar 22, 2025" },
  { id: 3, member: "Usman Khan", amount: "PKR 120,000", remaining: "PKR 90,000", installment: "PKR 12,000", dueDate: "Mar 25, 2025" },
];

export default function Loans() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Loan Management</h2>
          <p className="text-muted-foreground mt-1">Track and manage member loans</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Issue Loan
        </Button>
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
                <p className="text-2xl font-bold text-foreground">PKR 320,000</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-3xl font-bold text-foreground mt-2">8</p>
            <p className="text-sm text-muted-foreground mt-2">Members with loans</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">This Month Recovery</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR 80,000</p>
            <p className="text-sm text-secondary mt-2">Expected collection</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Active Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeLoans.map((loan) => (
              <div 
                key={loan.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-foreground">{loan.member}</h3>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Amount</p>
                      <p className="font-medium text-foreground">{loan.amount}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Remaining</p>
                      <p className="font-medium text-destructive">{loan.remaining}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monthly Installment</p>
                      <p className="font-medium text-foreground">{loan.installment}</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium text-foreground">{loan.dueDate}</p>
                  <Button size="sm" variant="outline" className="mt-2">
                    Record Payment
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
