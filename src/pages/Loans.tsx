import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import { useMemo, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function Loans() {
  const {
    members,
    activeLoans,
    totalLoanRecovered,
    addLoanIssue,
    addLoanCollection,
  } = useOrganization();
  const [openIssue, setOpenIssue] = useState(false);
  const [openCollection, setOpenCollection] = useState(false);
  const [issueFormData, setIssueFormData] = useState({
    memberId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [collectionFormData, setCollectionFormData] = useState({
    memberId: "",
    loanId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
  });

  // Get loans for selected member for collection form
  const memberLoansForCollection = useMemo(() => {
    if (!collectionFormData.memberId) return [];
    const member = members.find(
      (m) => m.id === Number(collectionFormData.memberId)
    );
    return member?.loans.filter((l) => l.status === "Active") || [];
  }, [collectionFormData.memberId, members]);

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueFormData.memberId || !issueFormData.amount) {
      toast.error("Please fill all fields");
      return;
    }
    addLoanIssue(
      Number(issueFormData.memberId),
      Number(issueFormData.amount),
      issueFormData.date
    );
    toast.success("Loan issued successfully");
    setOpenIssue(false);
    setIssueFormData({
      memberId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const handleCollectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !collectionFormData.memberId ||
      !collectionFormData.loanId ||
      !collectionFormData.amount
    ) {
      toast.error("Please fill all fields");
      return;
    }
    addLoanCollection(
      Number(collectionFormData.memberId),
      Number(collectionFormData.loanId),
      Number(collectionFormData.amount),
      collectionFormData.date
    );
    toast.success("Loan payment recorded successfully");
    setOpenCollection(false);
    setCollectionFormData({
      memberId: "",
      loanId: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const { settings } = useSettings();

  // Get all active loans with member details
  const activeLoansList = useMemo(() => {
    const loans: Array<{
      id: number;
      memberId: number;
      memberName: string;
      amount: number;
      amountWithInterest: number;
      remaining: number;
      date: string;
    }> = [];

    members.forEach((member) => {
      member.loans
        .filter((loan) => loan.status === "Active")
        .forEach((loan) => {
          const effectiveInterest = settings.applyLoanInterest
            ? settings.loanInterestRate
            : 0;
          const amountWithInterest =
            loan.amount * (1 + effectiveInterest / 100);
          loans.push({
            id: loan.id,
            memberId: member.id,
            memberName: member.name,
            amount: loan.amount,
            amountWithInterest,
            remaining: loan.remainingAmount,
            date: loan.date,
          });
        });
    });

    return loans;
  }, [members, settings.loanInterestRate, settings.applyLoanInterest]);

  const loanStats = useMemo(() => {
    const totalOutstanding = activeLoans;
    const activeLoanCount = activeLoansList.length;
    const membersWithLoans = new Set(activeLoansList.map((l) => l.memberId))
      .size;

    // Calculate total loans with 10% interest
    const totalWithInterest = activeLoansList.reduce(
      (sum, loan) => sum + loan.amountWithInterest,
      0
    );

    return {
      totalOutstanding,
      totalWithInterest,
      activeLoanCount,
      membersWithLoans,
      recoveredLoans: totalLoanRecovered,
    };
  }, [activeLoans, activeLoansList, totalLoanRecovered]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            Loan Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Track and manage member loans
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={openIssue} onOpenChange={setOpenIssue}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Issue Loan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Issue New Loan</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleIssueSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="issue-member">Select Member</Label>
                  <Select
                    value={issueFormData.memberId}
                    onValueChange={(value) =>
                      setIssueFormData({ ...issueFormData, memberId: value })
                    }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue-amount">Amount (PKR)</Label>
                  <Input
                    id="issue-amount"
                    type="number"
                    placeholder="Enter amount"
                    value={issueFormData.amount}
                    onChange={(e) =>
                      setIssueFormData({
                        ...issueFormData,
                        amount: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue-date">Date</Label>
                  <Input
                    id="issue-date"
                    type="date"
                    value={issueFormData.date}
                    onChange={(e) =>
                      setIssueFormData({
                        ...issueFormData,
                        date: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenIssue(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Issue Loan</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openCollection} onOpenChange={setOpenCollection}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Loan Payment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCollectionSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="collection-member">Select Member</Label>
                  <Select
                    value={collectionFormData.memberId}
                    onValueChange={(value) =>
                      setCollectionFormData({
                        ...collectionFormData,
                        memberId: value,
                        loanId: "",
                      })
                    }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id.toString()}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {collectionFormData.memberId && (
                  <div className="space-y-2">
                    <Label htmlFor="collection-loan">Select Loan</Label>
                    <Select
                      value={collectionFormData.loanId}
                      onValueChange={(value) =>
                        setCollectionFormData({
                          ...collectionFormData,
                          loanId: value,
                        })
                      }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a loan" />
                      </SelectTrigger>
                      <SelectContent>
                        {memberLoansForCollection.map((l) => (
                          <SelectItem key={l.id} value={l.id.toString()}>
                            Loan #{l.id} - Remaining: PKR{" "}
                            {l.remainingAmount.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="collection-amount">
                    Payment Amount (PKR)
                  </Label>
                  <Input
                    id="collection-amount"
                    type="number"
                    placeholder="Enter payment amount"
                    value={collectionFormData.amount}
                    onChange={(e) =>
                      setCollectionFormData({
                        ...collectionFormData,
                        amount: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="collection-date">Date</Label>
                  <Input
                    id="collection-date"
                    type="date"
                    value={collectionFormData.date}
                    onChange={(e) =>
                      setCollectionFormData({
                        ...collectionFormData,
                        date: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="flex justify-end gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenCollection(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Record Payment</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
                <p className="text-sm text-muted-foreground">
                  Total Outstanding
                </p>
                <p className="text-2xl font-bold text-foreground">
                  PKR {loanStats.totalWithInterest.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-3xl font-bold text-foreground mt-2">
              {loanStats.activeLoanCount}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {loanStats.membersWithLoans} members with loans
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recovered Loans</p>
                <p className="text-2xl font-bold text-foreground">
                  PKR {loanStats.recoveredLoans.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Active Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {activeLoansList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No active loans. Loan management can be done from member details.
            </p>
          ) : (
            <div className="space-y-4">
              {activeLoansList.map((loan) => (
                <div
                  key={`${loan.memberId}-${loan.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">
                        {loan.memberName}
                      </h3>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount Payable</p>
                        <p className="font-medium text-primary">
                          PKR {loan.amountWithInterest.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-medium text-destructive">
                          PKR {loan.remaining.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Issue Date</p>
                        <p className="font-medium text-foreground">
                          {new Date(loan.date).toLocaleDateString()}
                        </p>
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
