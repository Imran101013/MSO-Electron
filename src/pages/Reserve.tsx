import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
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
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export default function Reserve() {
  const {
    reserveFund,
    addReserveTransaction,
    reserveTransactions,
    totalDonations,
    totalExpenses,
  } = useOrganization();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "donation",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    donorName: "",
    notes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      type: formData.type as "donation" | "expense",
      amount: Number(formData.amount || 0),
      date: formData.date,
      donorName: formData.donorName || undefined,
      notes: formData.notes || undefined,
    };

    addReserveTransaction(payload);
    setOpen(false);
    setFormData({
      type: "donation",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      donorName: "",
      notes: "",
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTypeChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      type: value,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-foreground">Reserve Fund</h2>
          <p className="text-muted-foreground mt-1">
            Track donations and fund allocation
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-border p-4 bg-gradient-to-br from-background/70 to-muted/10">
            <form
              onSubmit={handleSubmit}
              className="flex flex-col h-full max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Add Transaction</DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Transaction Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={handleTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="donation">Reserve Fund</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (PKR)</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="text"
                    placeholder="Enter amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="donorName">
                    {formData.type === "donation" ? "Source" : "Spend at:"}
                  </Label>
                  <Input
                    id="donorName"
                    name="donorName"
                    placeholder={
                      formData.type === "donation"
                        ? "Enter source name"
                        : "Enter expense details"
                    }
                    value={formData.donorName}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Add any additional notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Transaction</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-md">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Balance</p>
            <p className="text-xl font-semibold text-foreground mt-2">
              PKR {reserveFund.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        {/* <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Reserve Fund</p>
                <p className="text-xl font-semibold text-foreground">
                  PKR {totalDonations.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card> */}
        <Card className="shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-semibold text-foreground">
                  PKR {totalExpenses.toLocaleString()}
                </p>
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
          {reserveTransactions.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No transactions yet
              </h3>
              <p className="text-muted-foreground mb-6">
                Start tracking donations and expenses for the reserve fund
              </p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Transaction
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="space-y-3">
              {reserveTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded border">
                  <div>
                    <div className="text-sm font-medium">
                      {tx.type === "donation" ? "Donation" : "Expense"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tx.date} • {tx.donorName ?? "-"}
                    </div>
                  </div>
                  <div
                    className={`font-semibold ${
                      tx.type === "donation"
                        ? "text-secondary"
                        : "text-destructive"
                    }`}>
                    PKR {tx.amount.toLocaleString()}
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
