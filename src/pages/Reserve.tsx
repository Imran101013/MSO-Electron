import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, PiggyBank, Wallet, ArrowDownCircle } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/hooks/useLoans";
import { useBooksConfig } from "@/lib/books";
import { useMemo, useState } from "react";
import { TablePager, usePaged } from "@/components/TablePager";
import { DatePicker } from "@/components/ui/date-picker";
import StatCard from "@/components/StatCard";
import AmountsNote from "@/components/AmountsNote";
import ViewReportButton from "@/components/ViewReportButton";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/contexts/SettingsContext";

export default function Reserve() {
  const {
    reserveFund,
    addReserveTransaction,
    reserveTransactions,
    totalDonations,
    totalExpenses,
  } = useOrganization();

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { settings } = useSettings();
  const { config: books } = useBooksConfig();
  const ordered = useMemo(() => [...reserveTransactions].reverse(), [reserveTransactions]);
  const paged = usePaged(ordered);
  const [formData, setFormData] = useState({
    type: "donation",
    amount: "",
    date: undefined as Date | undefined,
    donorName: "",
    notes: "",
    bankCharge: "",
  });
  // An expense above the limit in Settings is paid by a cheque the bank charges for.
  const needsCharge = formData.type === "expense" && Number(formData.amount) > settings.bankChargeThreshold;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(formData.amount);
    if (!formData.amount || !Number.isFinite(amount) || amount <= 0) return;
    setIsSubmitting(true);
    const success = await addReserveTransaction({
      type: formData.type as "donation" | "expense",
      amount,
      date: format(formData.date ?? new Date(), "yyyy-MM-dd"),
      donorName: formData.donorName || undefined,
      notes: formData.notes || undefined,
      bankCharge: needsCharge ? Number(formData.bankCharge) || 0 : 0,
    });
    setIsSubmitting(false);
    if (success) {
      setOpen(false);
      setFormData({ type: "donation", amount: "", date: undefined, donorName: "", notes: "", bankCharge: "" });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-accent/70 pb-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground mt-1">Reserve Fund</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track donations and fund allocation</p>
            <AmountsNote />
          </div>
        </div>

        <div className="flex gap-2">
          <ViewReportButton request={{ kind: "reserve-ledger" }} label="Reserve Fund Ledger" size="default" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm rounded-sm">
                <Plus className="w-4 h-4" /> Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-sm">
              {/* Header */}
              <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">Add Transaction</DialogTitle>
                  <p className="text-xs text-muted-foreground">Record a deposit or expense</p>
                </div>
              </div>
  
              <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Transaction Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData((p) => ({ ...p, type: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="donation">Deposit / Donation</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
  
                  <div className="space-y-1.5">
                    <Label htmlFor="amount" className="text-xs font-medium">Amount</Label>
                    <Input id="amount" name="amount" type="number" min="0" step="0.01" placeholder="Enter amount" className="h-9"
                      value={formData.amount} onChange={handleInputChange} required />
                  </div>

                  {needsCharge && (
                    <div className="space-y-1.5">
                      <Label htmlFor="bankCharge" className="text-xs font-medium">Bank charge on this withdrawal</Label>
                      <Input id="bankCharge" name="bankCharge" type="number" min="0" step="0.01" placeholder="From the bank statement" className="h-9"
                        value={formData.bankCharge} onChange={handleInputChange} />
                      <p className="text-xs text-muted-foreground">
                        Expenses above {settings.bankChargeThreshold.toLocaleString()} are paid by a cheque the bank charges for. The reserve fund pays the
                        charge; it is recorded as a second expense on the same day.
                      </p>
                    </div>
                  )}
  
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Date</Label>
                    <DatePicker
                      date={formData.date}
                      onDateChange={(date) => setFormData((p) => ({ ...p, date: date || new Date() }))}
                      placeholder="Pick a date"
                      disabledThrough={books.cutoverDate}
                    />
                  </div>
  
                  <div className="space-y-1.5">
                    <Label htmlFor="donorName" className="text-xs font-medium">
                      {formData.type === "donation" ? "Source" : "Spent At"}
                    </Label>
                    <Input id="donorName" name="donorName" className="h-9"
                      placeholder={formData.type === "donation" ? "Enter source name" : "Enter expense details"}
                      value={formData.donorName} onChange={handleInputChange} />
                  </div>
  
                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="text-xs font-medium">Notes</Label>
                    <Textarea id="notes" name="notes" placeholder="Add any additional notes"
                      value={formData.notes} onChange={handleInputChange} rows={3} className="resize-none" />
                  </div>
                </div>
  
                <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={isSubmitting}>{isSubmitting ? "Adding…" : "Add Transaction"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Wallet}
          title="Current Balance"
          value={reserveFund.toLocaleString()}
          iconColor="border-primary/40 bg-primary/10 text-primary"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Deposits"
          value={totalDonations.toLocaleString()}
          iconColor="border-secondary/40 bg-secondary/10 text-secondary"
        />
        <StatCard
          icon={ArrowDownCircle}
          title="Total Expenses"
          value={totalExpenses.toLocaleString()}
          iconColor="border-destructive/40 bg-destructive/10 text-destructive"
        />
      </div>

      {/* Transactions Table */}
      <Card className="shadow-sm rounded-sm border-0 border-t-2 border-t-accent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              Transactions
            </CardTitle>
            <div className="flex items-center gap-3">
              {reserveTransactions.length > 0 && (
                <span className="figure text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-sm">
                  {reserveTransactions.length} record{reserveTransactions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {reserveTransactions.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-14 h-14 rounded-sm border-2 border-border bg-muted flex items-center justify-center mx-auto mb-4">
                <PiggyBank className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No transactions yet</h3>
              <p className="text-xs text-muted-foreground mb-5">
                Start tracking donations and expenses for the reserve fund
              </p>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2 rounded-sm">
                    <Plus className="w-3.5 h-3.5" /> Add Transaction
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {/* Table header */}
              <div className="grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] px-5 py-2.5 bg-muted/50">
                <span className="col-span-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</span>
                <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
                <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Source / Spent At</span>
                <span className="col-span-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</span>
                <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
                <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
              </div>

              {/* Rows */}
              {paged.rows.map((tx, idx) => {
                const isInflow = tx.type !== "expense";
                const label = tx.type === "expense" ? "Expense" : tx.type === "profit_allocation" ? "Profit Share" : tx.type === "opening" ? "Brought forward" : "Deposit";
                return (
                <div
                  key={tx.id}
                  className="grid grid-cols-[2.5rem_repeat(12,minmax(0,1fr))] px-5 py-2 items-center hover:bg-muted/30 transition-colors"
                >
                  <span className="figure col-span-1 text-xs text-muted-foreground">
                    {reserveTransactions.length - (paged.offset + idx)}
                  </span>

                  <div className="col-span-2">
                    <Badge variant={isInflow ? "secondary" : "destructive"}>
                      {isInflow
                        ? <TrendingUp className="w-3 h-3" />
                        : <TrendingDown className="w-3 h-3" />}
                      {label}
                    </Badge>
                  </div>

                  <span className="col-span-3 text-sm text-foreground truncate pr-2">
                    {tx.donorName || <span className="text-muted-foreground">—</span>}
                  </span>

                  <span className="col-span-3 text-xs text-muted-foreground truncate pr-2">
                    {tx.notes || "—"}
                  </span>

                  <span className="figure col-span-2 text-xs text-muted-foreground">{format(parseLocalDate(String(tx.date).slice(0, 10)), settings.dateFormat)}</span>

                  <span className={cn(
                    "figure col-span-2 text-sm font-bold text-right whitespace-nowrap",
                    isInflow
                      ? "text-secondary"
                      : "text-destructive"
                  )}>
                    {isInflow ? "+" : "-"}{tx.amount.toLocaleString()}
                  </span>
                </div>
                );
              })}

              <TablePager paged={paged} noun="transactions" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
