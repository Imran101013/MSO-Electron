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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

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
    const activeLoanCount = activeLoansList.length;
    const membersWithLoans = new Set(activeLoansList.map((l) => l.memberId))
      .size;

    // Calculate total outstanding as sum of remaining amounts for active loans
    const totalOutstanding = activeLoansList.reduce(
      (sum, loan) => sum + loan.remaining,
      0
    );

    // Calculate total recovered from all loan installments
    const recoveredLoans = members.reduce((sum, member) => {
      const memberRecovered = member.loans.reduce((loanSum, loan) => {
        const installmentsSum = loan.installments.reduce(
          (instSum, inst) => instSum + inst.amount,
          0
        );
        return loanSum + installmentsSum;
      }, 0);
      return sum + memberRecovered;
    }, 0);

    return {
      totalOutstanding,
      activeLoanCount,
      membersWithLoans,
      recoveredLoans,
    };
  }, [activeLoansList, members]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">
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
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-border p-4 bg-gradient-to-br from-background/70 to-muted/10">
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
                    type="text"
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
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-border p-4 bg-gradient-to-br from-background/70 to-muted/10">
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
                    type="text"
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
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Outstanding
                </p>
                <p className="text-xl font-semibold text-foreground">
                  PKR {loanStats.totalOutstanding.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active Loans</p>
            <p className="text-xl font-semibold text-foreground mt-2">
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
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Recovered Loans</p>
                <p className="text-xl font-semibold text-foreground">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount Payable</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Issue Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLoansList.map((loan) => (
                  <TableRow key={`${loan.memberId}-${loan.id}`}>
                    <TableCell className="font-medium">
                      {loan.memberName}
                    </TableCell>
                    <TableCell>
                      PKR {loan.amountWithInterest.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      PKR{" "}
                      {(
                        loan.amountWithInterest - loan.remaining
                      ).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-destructive">
                      PKR {loan.remaining.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {format(new Date(loan.date), settings.dateFormat)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
