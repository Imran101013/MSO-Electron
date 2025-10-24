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

      {/* Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Getting Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Welcome to AL-Hilal Organization Management System. Start by adding members to your organization.
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Add members from the Members page</li>
                <li>Track monthly contributions</li>
                <li>Manage loans and reserve funds</li>
                <li>Schedule and record meetings</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Members</span>
                <span className="text-lg font-bold text-foreground">{totalMembers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Budget</span>
                <span className="text-lg font-bold text-foreground">PKR {totalBudget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Active Loans</span>
                <span className="text-lg font-bold text-foreground">PKR {activeLoans.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
