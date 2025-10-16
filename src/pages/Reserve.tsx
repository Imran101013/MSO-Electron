import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";

const transactions = [
  { id: 1, type: "donation", donor: "Anonymous", amount: "PKR 25,000", date: "Mar 5, 2025", purpose: "Community welfare" },
  { id: 2, type: "expense", donor: "Medical Aid", amount: "PKR 15,000", date: "Mar 3, 2025", purpose: "Member healthcare" },
  { id: 3, type: "donation", donor: "Muhammad Yousaf", amount: "PKR 30,000", date: "Feb 28, 2025", purpose: "General fund" },
];

export default function Reserve() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reserve Fund</h2>
          <p className="text-muted-foreground mt-1">Track donations and fund allocation</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Add Transaction
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Current Balance</p>
            <p className="text-3xl font-bold text-foreground mt-2">PKR 125,000</p>
            <p className="text-sm text-secondary mt-2">Available for allocation</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Donations</p>
                <p className="text-2xl font-bold text-foreground">PKR 250,000</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-foreground">PKR 125,000</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div 
                key={transaction.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    transaction.type === 'donation' ? 'bg-secondary/10' : 'bg-destructive/10'
                  }`}>
                    {transaction.type === 'donation' ? (
                      <TrendingUp className="w-5 h-5 text-secondary" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{transaction.donor}</h3>
                    <p className="text-sm text-muted-foreground">{transaction.purpose}</p>
                    <p className="text-xs text-muted-foreground mt-1">{transaction.date}</p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${
                  transaction.type === 'donation' ? 'text-secondary' : 'text-destructive'
                }`}>
                  {transaction.type === 'donation' ? '+' : '-'} {transaction.amount}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
