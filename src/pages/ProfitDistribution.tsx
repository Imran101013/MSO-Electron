import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { format } from "date-fns";
import { DollarSign, PieChart, Users, PiggyBank, Loader2, AlertTriangle, History, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import StatCard from "@/components/StatCard";

export default function ProfitDistribution() {
  const [profitAmount, setProfitAmount] = useState<string>("");
  const [isDistributing, setIsDistributing] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const { calculateBudgetRatios, distributeProfit, profitDistributions } = useOrganization();
  const { settings } = useSettings();

  const budgetRatios = calculateBudgetRatios();
  const totalProfit = parseFloat(profitAmount) || 0;
  const reserveAllocation = totalProfit * 0.1;
  const distributableAmount = totalProfit * 0.9;

  // Latest completed distribution (most recent by date)
  const latestDist = profitDistributions.length > 0
    ? [...profitDistributions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Cards show live preview while user is typing, otherwise show latest distribution
  const cardProfit = totalProfit > 0 ? totalProfit : latestDist?.totalProfit ?? 0;
  const cardReserve = totalProfit > 0 ? reserveAllocation : latestDist?.reserveAllocation ?? 0;
  const cardMembers = totalProfit > 0 ? distributableAmount : latestDist ? latestDist.totalProfit - latestDist.reserveAllocation : 0;
  const hasCardData = cardProfit > 0;

  const memberAllocations = budgetRatios.map((ratio) => ({
    ...ratio,
    amount: Math.round(distributableAmount * ratio.ratio * 100) / 100,
  }));

  const handleDistributeProfit = async () => {
    if (totalProfit <= 0) { toast.error("Please enter a valid profit amount"); return; }
    if (budgetRatios.length === 0) { toast.error("No meeting data available for distribution calculation"); return; }
    setIsDistributing(true);
    try {
      // Persist with an ISO date (Postgres DATE column) — display formatting (settings.dateFormat)
      // is only applied when rendering dates back, not when writing them.
      const isoDate = new Date().toISOString().split("T")[0];
      const success = await distributeProfit(totalProfit, isoDate);
      if (success) {
        toast.success("Profit distributed successfully!");
        setProfitAmount("");
      }
    } catch {
      toast.error("Failed to distribute profit");
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header — statement letterhead */}
      <div className="flex items-center justify-between border-b-2 border-primary/40 pb-4">
        <div>
          <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Year-End Settlement</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Profit Distribution</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Distribute yearly profits to members and reserve fund</p>
        </div>
      </div>

      {/* Input + Summary row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input card */}
        <Card className="shadow-sm rounded-sm border-0 border-t-2 border-t-primary/70 lg:col-span-1">
          <CardHeader className="pb-3">
            {/* <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              Total Profit
            </CardTitle> */}
            {/* <CardDescription className="text-xs">Enter the amount to distribute</CardDescription> */}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 gap-3">
              <Label htmlFor="profitAmount" className="text-sm">Amount ({settings.currency})</Label>
              <Input
                id="profitAmount"
                type="number"
                placeholder="e.g. 500000"
                value={profitAmount}
                onChange={(e) => setProfitAmount(e.target.value)}
                min="0"
                step="0.01"
                className="h-8 w-32 mb-4 text-lg font-semibold"
              />
            </div>
            {totalProfit > 0 && (
              <Button
                onClick={handleDistributeProfit}
                disabled={isDistributing || budgetRatios.length === 0}
                className="w-full h-10 gap-2 shadow-sm"
              >
                {isDistributing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Distributing…</>
                  : <><DollarSign className="w-4 h-4" /> Confirm Distribution</>}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Summary stat cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={DollarSign}
            title={totalProfit > 0 ? "Total Profit (Preview)" : latestDist ? "Last Total Profit" : "Total Profit"}
            value={hasCardData ? `${settings.currency} ${cardProfit.toLocaleString()}` : "—"}
            trend={!totalProfit && latestDist ? `Distributed on ${format(new Date(latestDist.date), settings.dateFormat)}` : undefined}
            trendUp
            iconColor="border-primary/40 bg-primary/10 text-primary"
          />
          <StatCard
            icon={PiggyBank}
            title={totalProfit > 0 ? "Reserve Fund (10%)" : latestDist ? "Last Reserve (10%)" : "Reserve Fund (10%)"}
            value={hasCardData ? `${settings.currency} ${cardReserve.toLocaleString()}` : "—"}
            iconColor="border-accent/50 bg-accent/15 text-accent-foreground"
          />
          <StatCard
            icon={Users}
            title={totalProfit > 0 ? "Members Share (90%)" : latestDist ? "Last Members Share" : "Members Share (90%)"}
            value={hasCardData ? `${settings.currency} ${cardMembers.toLocaleString()}` : "—"}
            iconColor="border-secondary/40 bg-secondary/10 text-secondary"
          />
        </div>
      </div>

      {/* No meeting data warning */}
      {totalProfit > 0 && budgetRatios.length === 0 && (
        <Card className="rounded-sm border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 shadow-sm">
          <CardContent className="flex items-start gap-4 pt-5 pb-5">
            <div className="w-9 h-9 rounded-sm border-2 border-amber-300/60 bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">No Meeting Data Available</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Profit distribution requires meeting data to calculate member contribution ratios.
                Please ensure there are meetings with contributions recorded.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Preview */}
      {totalProfit > 0 && budgetRatios.length > 0 && (
        <Card className="shadow-sm rounded-sm border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-secondary/40 bg-secondary/10 flex items-center justify-center">
                <PieChart className="w-4 h-4 text-secondary" />
              </div>
              Member Allocation Preview
            </CardTitle>
            <CardDescription className="text-xs">
              Based on contribution ratios — {memberAllocations.length} members
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table header */}
            <div className="grid grid-cols-12 px-5 py-2.5 bg-muted/50">
              <span className="col-span-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</span>
              <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Member</span>
              <span className="col-span-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contribution Ratio</span>
              <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Allocation</span>
            </div>
            <div className="divide-y divide-border/60">
              {memberAllocations.map((a, idx) => (
                <div key={a.memberId} className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-muted/30 transition-colors">
                  <span className="col-span-1 text-xs text-muted-foreground">{idx + 1}</span>
                  <div className="col-span-4">
                    <p className="text-sm font-medium text-foreground">{a.memberName}</p>
                  </div>
                  <div className="col-span-4 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-sm"
                          style={{ width: `${(a.ratio * 100).toFixed(1)}%` }}
                        />
                      </div>
                      <span className="figure text-xs text-muted-foreground w-10 text-right">
                        {(a.ratio * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="figure text-sm font-bold text-secondary">
                      {settings.currency} {a.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Footer totals */}
            <div className="grid grid-cols-12 px-5 py-3 bg-muted/40 border-t border-border/60">
              <span className="col-span-5 text-xs font-semibold text-muted-foreground">Total Members Share</span>
              <span className="figure col-span-4 text-xs font-semibold text-muted-foreground">100%</span>
              <span className="figure col-span-3 text-right text-sm font-bold text-foreground">
                {settings.currency} {distributableAmount.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution History */}
      {profitDistributions.length > 0 && (
        <Card className="shadow-sm rounded-sm border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                  <History className="w-4 h-4 text-primary" />
                </div>
                Distribution History
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-sm font-normal">
                {profitDistributions.length} record{profitDistributions.length !== 1 ? "s" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/60">
              {[...profitDistributions].reverse().map((dist, idx) => {
                const isExpanded = expandedHistory === dist.id;
                return (
                  <div key={dist.id}>
                    {/* Row header */}
                    <button
                      onClick={() => setExpandedHistory(isExpanded ? null : dist.id)}
                      className="w-full grid grid-cols-12 px-5 py-4 items-center hover:bg-muted/30 transition-colors text-left"
                    >
                      <span className="col-span-1 text-xs text-muted-foreground">{profitDistributions.length - idx}</span>
                      <div className="col-span-4">
                        <p className="text-sm font-semibold text-foreground">
                          {format(new Date(dist.date), settings.dateFormat)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dist.memberAllocations.length} members
                        </p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs text-muted-foreground">Reserve</p>
                        <p className="figure text-sm font-semibold text-amber-600 dark:text-amber-400">
                          {settings.currency} {dist.reserveAllocation.toLocaleString()}
                        </p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs text-muted-foreground">Total Profit</p>
                        <p className="figure text-sm font-bold text-foreground">
                          {settings.currency} {dist.totalProfit.toLocaleString()}
                        </p>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded member allocations */}
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-muted/20">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                          Member Allocations
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {dist.memberAllocations.map((a) => (
                            <div
                              key={a.memberId}
                              className="flex items-center justify-between px-3 py-2 rounded-sm bg-background border border-border/60"
                            >
                              <span className="text-sm text-foreground font-medium truncate mr-2">{a.memberName}</span>
                              <span className="figure text-sm font-bold text-secondary whitespace-nowrap">
                                {settings.currency} {a.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
