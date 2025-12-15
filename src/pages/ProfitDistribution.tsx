import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { format } from "date-fns";
import { DollarSign, PieChart, Users, PiggyBank } from "lucide-react";
import { toast } from "sonner";

export default function ProfitDistribution() {
  const [profitAmount, setProfitAmount] = useState<string>("");
  const [isDistributing, setIsDistributing] = useState(false);
  const { calculateBudgetRatios, distributeProfit, profitDistributions } =
    useOrganization();
  const { settings } = useSettings();

  const budgetRatios = calculateBudgetRatios();
  const totalProfit = parseFloat(profitAmount) || 0;
  const reserveAllocation = totalProfit * 0.1;
  const distributableAmount = totalProfit * 0.9;

  const memberAllocations = budgetRatios.map((ratio) => ({
    ...ratio,
    amount: Math.round(distributableAmount * ratio.ratio * 100) / 100,
  }));

  const handleDistributeProfit = async () => {
    if (totalProfit <= 0) {
      toast.error("Please enter a valid profit amount");
      return;
    }

    if (budgetRatios.length === 0) {
      toast.error("No meeting data available for distribution calculation");
      return;
    }

    setIsDistributing(true);
    try {
      const distributionDate = format(new Date(), settings.dateFormat);
      distributeProfit(totalProfit, distributionDate);
      toast.success("Profit distributed successfully!");
      setProfitAmount("");
    } catch (error) {
      toast.error("Failed to distribute profit");
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-semibold text-foreground">
          Profit Distribution
        </h2>
        <p className="text-muted-foreground mt-1">
          Distribute yearly profits to members and reserve fund
        </p>
      </div>

      {/* Input Form */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Enter Profit Amount
          </CardTitle>
          <CardDescription>
            Enter the total profit amount to distribute
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="profitAmount">Total Profit (PKR)</Label>
                <Input
                  id="profitAmount"
                  type="number"
                  placeholder="Enter profit amount"
                  value={profitAmount}
                  onChange={(e) => setProfitAmount(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* No Meeting Data Message */}
      {totalProfit > 0 && budgetRatios.length === 0 && (
        <Card className="shadow-md border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <PieChart className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                No Meeting Data Available
              </h3>
              <p className="text-yellow-700">
                Profit distribution requires meeting data to calculate member
                contribution ratios. Please ensure there are meetings with
                contributions recorded.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution Preview */}
      {totalProfit > 0 && budgetRatios.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-secondary" />
              Distribution Preview
            </CardTitle>
            <CardDescription>
              Preview of how the profit will be distributed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <PiggyBank className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Reserve Fund (10%)
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    PKR {reserveAllocation.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-lg">
                  <Users className="w-8 h-8 text-secondary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Members (90%)</p>
                  <p className="text-2xl font-bold text-secondary">
                    PKR {distributableAmount.toLocaleString()}
                  </p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <DollarSign className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">
                    PKR {totalProfit.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Member Allocations */}
              <div>
                <h4 className="text-lg font-semibold mb-4">
                  Member Allocations
                </h4>
                <div className="space-y-3">
                  {memberAllocations.map((allocation) => (
                    <div
                      key={allocation.memberId}
                      className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{allocation.memberName}</p>
                        <p className="text-sm text-muted-foreground">
                          Ratio: {(allocation.ratio * 100).toFixed(2)}%
                        </p>
                      </div>
                      <p className="font-semibold">
                        PKR {allocation.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleDistributeProfit}
                  disabled={isDistributing}
                  size="lg">
                  {isDistributing ? "Distributing..." : "Distribute Profit"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Distribution History */}
      {profitDistributions.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Distribution History</CardTitle>
            <CardDescription>Previous profit distributions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {profitDistributions.map((distribution) => (
                <div
                  key={distribution.id}
                  className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        {format(
                          new Date(distribution.date),
                          settings.dateFormat
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Profit: PKR{" "}
                        {distribution.totalProfit.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Reserve Allocation
                      </p>
                      <p className="font-semibold">
                        PKR {distribution.reserveAllocation.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Member Allocations:
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {distribution.memberAllocations.map((allocation) => (
                        <div
                          key={allocation.memberId}
                          className="text-sm p-2 bg-muted/50 rounded">
                          <span className="font-medium">
                            {allocation.memberName}:
                          </span>{" "}
                          PKR {allocation.amount.toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
