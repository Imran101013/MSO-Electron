import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, CheckCircle2, Loader2 } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { useLoans } from "@/hooks/useLoans";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/contexts/AuthContext";

export default function Loans() {
  const { loans, isLoading, issueLoan, recordPayment, getActiveLoans, getLoanStats } = useLoans();
  const { members, isLoading: membersLoading } = useMembers();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  
  const [openIssue, setOpenIssue] = useState(false);
  const [openCollection, setOpenCollection] = useState(false);
  const [issueFormData, setIssueFormData] = useState({
    memberId: "",
    amount: "",
    date: new Date(),
  });
  const [collectionFormData, setCollectionFormData] = useState({
    memberId: "",
    loanId: "",
    amount: "",
    date: new Date(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get active loans for selected member for collection form
  const memberLoansForCollection = useMemo(() => {
    if (!collectionFormData.memberId) return [];
    return loans.filter(
      (loan) => loan.member_id === collectionFormData.memberId && loan.status === "active"
    );
  }, [collectionFormData.memberId, loans]);

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueFormData.memberId || !issueFormData.amount) {
      toast.error("Please fill all fields");
      return;
    }
    
    setIsSubmitting(true);
    await issueLoan({
      member_id: issueFormData.memberId,
      amount: Number(issueFormData.amount),
      loan_date: format(issueFormData.date, "yyyy-MM-dd"),
    });
    setIsSubmitting(false);
    setOpenIssue(false);
    setIssueFormData({
      memberId: "",
      amount: "",
      date: new Date(),
    });
  };

  const handleCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !collectionFormData.memberId ||
      !collectionFormData.loanId ||
      !collectionFormData.amount
    ) {
      toast.error("Please fill all fields");
      return;
    }
    
    setIsSubmitting(true);
    await recordPayment({
      loan_id: collectionFormData.loanId,
      amount: Number(collectionFormData.amount),
      payment_date: format(collectionFormData.date, "yyyy-MM-dd"),
    });
    setIsSubmitting(false);
    setOpenCollection(false);
    setCollectionFormData({
      memberId: "",
      loanId: "",
      amount: "",
      date: new Date(),
    });
  };

  const activeLoans = getActiveLoans();
  const loanStats = getLoanStats();

  if (isLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
        {isAdmin && (
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
                        {members.filter(m => m.is_approved).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
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
                    <DatePicker
                      date={issueFormData.date}
                      onDateChange={(date) =>
                        setIssueFormData({
                          ...issueFormData,
                          date: date || new Date(),
                        })
                      }
                      placeholder="Pick a date"
                    />
                  </div>
                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenIssue(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Issuing...
                        </>
                      ) : (
                        "Issue Loan"
                      )}
                    </Button>
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
                        {members.filter(m => m.is_approved).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
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
                            <SelectItem key={l.id} value={l.id}>
                              Loan - Remaining: PKR {l.remaining_amount.toLocaleString()}
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
                    <DatePicker
                      date={collectionFormData.date}
                      onDateChange={(date) =>
                        setCollectionFormData({
                          ...collectionFormData,
                          date: date || new Date(),
                        })
                      }
                      placeholder="Pick a date"
                    />
                  </div>
                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenCollection(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Recording...
                        </>
                      ) : (
                        "Record Payment"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
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
              {loanStats.activeLoansCount}
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
                  PKR {loanStats.totalRecovered.toLocaleString()}
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
          {activeLoans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No active loans.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Issue Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">
                      {loan.member_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      PKR {loan.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      PKR {(loan.amount - loan.remaining_amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-destructive">
                      PKR {loan.remaining_amount.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {format(new Date(loan.loan_date), settings.dateFormat)}
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
