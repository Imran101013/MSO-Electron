import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Wallet, HandCoins, PiggyBank, Calendar, TrendingUp } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function Dashboard() {
  const { totalBudget, totalMembers, activeLoans, reserveFund } = useOrganization();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Welcome to AL-Hilal Organization Management</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Members"
          value={totalMembers.toString()}
          icon={Users}
          trend="+3 this month"
          trendUp={true}
        />
        <StatCard
          title="Total Budget"
          value={`PKR ${totalBudget.toLocaleString()}`}
          icon={Wallet}
          trend="+PKR 42,000"
          trendUp={true}
        />
        <StatCard
          title="Active Loans"
          value={`PKR ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
          trend="8 members"
        />
        <StatCard
          title="Reserve Fund"
          value={`PKR ${reserveFund.toLocaleString()}`}
          icon={PiggyBank}
          trend="+PKR 15,000"
          trendUp={true}
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Meeting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium text-foreground">Monthly General Meeting</p>
                  <p className="text-sm text-muted-foreground">March 15, 2025 at 7:00 PM</p>
                </div>
                <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                  In 5 days
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Agenda:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Review monthly budget collection</li>
                  <li>Discuss new loan applications</li>
                  <li>Reserve fund allocation</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-secondary mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">New member added</p>
                  <p className="text-xs text-muted-foreground">Muhammad Asif joined the organization</p>
                  <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Loan repayment received</p>
                  <p className="text-xs text-muted-foreground">PKR 15,000 from Ahmed Ali</p>
                  <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Monthly budget collected</p>
                  <p className="text-xs text-muted-foreground">PKR 42,000 from 42 members</p>
                  <p className="text-xs text-muted-foreground mt-1">3 days ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
