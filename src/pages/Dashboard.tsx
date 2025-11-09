import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Wallet, HandCoins, PiggyBank, Calendar, TrendingUp, Clock, Trophy, AlertCircle } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, parseISO, isPast } from "date-fns";
import { useEffect, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Dashboard() {
  const { 
    totalBudget, 
    totalMembers, 
    activeLoans, 
    reserveFund, 
    upcomingMeetings, 
    setUpcomingMeetings,
    budgetTrend,
    membersTrend,
    loansTrend,
    reserveTrend,
    members
  } = useOrganization();

  // Calculate top contributors
  const topContributors = useMemo(() => {
    return [...members]
      .sort((a, b) => b.totalBudget - a.totalBudget)
      .slice(0, 5);
  }, [members]);

  // Calculate members with pending loans
  const membersWithPendingLoans = useMemo(() => {
    return members
      .filter(member => member.loans.some(loan => loan.status === "Active"))
      .map(member => {
        const activeLoans = member.loans.filter(loan => loan.status === "Active");
        const totalPending = activeLoans.reduce((sum, loan) => sum + loan.remainingAmount, 0);
        return {
          ...member,
          totalPending,
          activeLoansCount: activeLoans.length
        };
      })
      .sort((a, b) => b.totalPending - a.totalPending)
      .slice(0, 5);
  }, [members]);

  // Filter out past meetings
  useEffect(() => {
    const filteredMeetings = upcomingMeetings.filter(meeting => {
      const meetingDateTime = parseISO(`${meeting.date}T${meeting.time}`);
      return !isPast(meetingDateTime);
    });
    
    if (filteredMeetings.length !== upcomingMeetings.length) {
      setUpcomingMeetings(filteredMeetings);
    }
  }, [upcomingMeetings, setUpcomingMeetings]);

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
          trend={membersTrend ? `${membersTrend.amount >= 0 ? '+' : ''}${membersTrend.amount} this month` : undefined}
          trendUp={membersTrend ? membersTrend.amount >= 0 : undefined}
        />
        <StatCard
          title="Total Budget"
          value={`PKR ${totalBudget.toLocaleString()}`}
          icon={Wallet}
          trend={budgetTrend ? `${budgetTrend.amount >= 0 ? '+' : ''}PKR ${Math.abs(budgetTrend.amount).toLocaleString()} (${budgetTrend.percentage.toFixed(1)}%)` : undefined}
          trendUp={budgetTrend ? budgetTrend.amount >= 0 : undefined}
        />
        <StatCard
          title="Active Loans"
          value={`PKR ${activeLoans.toLocaleString()}`}
          icon={HandCoins}
          trend={loansTrend ? `${loansTrend.amount >= 0 ? '+' : ''}PKR ${Math.abs(loansTrend.amount).toLocaleString()} net change` : undefined}
          trendUp={loansTrend ? loansTrend.amount < 0 : undefined}
        />
        <StatCard
          title="Reserve Fund"
          value={`PKR ${reserveFund.toLocaleString()}`}
          icon={PiggyBank}
          trend={reserveTrend ? `${reserveTrend.amount >= 0 ? '+' : ''}PKR ${Math.abs(reserveTrend.amount).toLocaleString()}` : undefined}
          trendUp={reserveTrend ? reserveTrend.amount >= 0 : undefined}
        />
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Upcoming Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMeetings.length > 0 ? (
              <div className="space-y-4">
                {upcomingMeetings.map(meeting => (
                  <div key={meeting.id} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-foreground">{meeting.agenda}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {format(parseISO(meeting.date), "PPP")} at {meeting.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No upcoming meetings scheduled</p>
                <p className="text-xs text-muted-foreground mt-1">Schedule a meeting from the Meetings page</p>
              </div>
            )}
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

      {/* Top Contributors & Pending Loans */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Top Contributors
            </CardTitle>
            <CardDescription>Members with highest total contributions</CardDescription>
          </CardHeader>
          <CardContent>
            {topContributors.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Total Budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topContributors.map((member, index) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profilePicture} />
                            <AvatarFallback className="bg-gradient-primary">
                              <span className="text-primary-foreground text-xs font-semibold">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        PKR {member.totalBudget.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No contributors yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Pending Loan Payments
            </CardTitle>
            <CardDescription>Members with active loan balances</CardDescription>
          </CardHeader>
          <CardContent>
            {membersWithPendingLoans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-center">Loans</TableHead>
                    <TableHead className="text-right">Amount Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersWithPendingLoans.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.profilePicture} />
                            <AvatarFallback className="bg-gradient-primary">
                              <span className="text-primary-foreground text-xs font-semibold">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{member.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                          {member.activeLoansCount}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-destructive">
                        PKR {member.totalPending.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <HandCoins className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pending loans</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
