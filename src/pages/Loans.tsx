import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, CheckCircle2, Loader2, HandCoins, AlertTriangle, BookOpen, Ban, Percent, ArrowRight, Landmark } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import StatCard from "@/components/StatCard";
import AmountsNote from "@/components/AmountsNote";
import ViewReportButton from "@/components/ViewReportButton";
import { useMemo, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLoans, LoanWithMember, parseLocalDate } from "@/hooks/useLoans";
import { dueIn, loanDueDate } from "@/utils/loanPenalty";
import { loanIncome } from "@/utils/loanInterest";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useBooksConfig } from "@/lib/books";
import { TablePager, usePaged } from "@/components/TablePager";

const issueSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  amount: z.coerce.number({ invalid_type_error: "Enter a valid amount" }).positive("Amount must be greater than 0"),
  date: z.date({ required_error: "Please pick a date" }),
  /** The bank's charge on the cheque withdrawal, for loans above the limit in Settings. */
  bankCharge: z.coerce.number({ invalid_type_error: "Enter a valid amount" }).min(0, "Can't be negative").optional(),
});
type IssueFormValues = z.infer<typeof issueSchema>;

const buildPaymentSchema = (maxAmount: number) =>
  z.object({
    memberId: z.string().min(1, "Please select a member"),
    loanId: z.string().min(1, "Please select a loan"),
    amount: z.coerce
      .number({ invalid_type_error: "Enter a valid amount" })
      .positive("Amount must be greater than 0")
      .max(maxAmount, `Cannot exceed remaining balance of ${maxAmount.toLocaleString()}`),
    date: z.date({ required_error: "Please pick a date" }),
  });
type PaymentFormValues = z.infer<ReturnType<typeof buildPaymentSchema>>;

export default function Loans() {
  const { loans, installments, penalties, isLoading, issueLoan, recordPayment, markDefaulted, setBankCharge, getActiveLoans, getLoanStats, isOverdue } = useLoans();
  const { members, isLoading: membersLoading } = useMembers();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const [openIssue, setOpenIssue] = useState(false);
  const [openCollection, setOpenCollection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewLoan, setViewLoan] = useState<LoanWithMember | null>(null);
  const [defaultOpen, setDefaultOpen] = useState(false);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>(undefined);
  const [defaultSaving, setDefaultSaving] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeText, setChargeText] = useState("");
  const [chargeSaving, setChargeSaving] = useState(false);

  const issueForm = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: { memberId: "", amount: 0, date: new Date() },
  });

  const paymentForm = useForm<PaymentFormValues>({
    resolver: (values, context, options) => {
      const selectedLoan = loans.find((l) => l.id === (values as PaymentFormValues).loanId);
      const schema = buildPaymentSchema(selectedLoan?.remaining_amount ?? Number.MAX_SAFE_INTEGER);
      return zodResolver(schema)(values, context, options);
    },
    defaultValues: { memberId: "", loanId: "", amount: 0, date: new Date() },
  });

  // Terms shown in the Issue Loan dialog, worked out the same way issueLoan records them.
  const issueRate = settings.applyLoanInterest ? settings.loanInterestRate : 0;
  const issueTotal = Math.round((Number(issueForm.watch("amount")) || 0) * (1 + issueRate / 100) * 100) / 100;
  // A cheque withdrawal above the limit in Settings carries a bank charge, repaid by the member with the loan.
  const issueNeedsCharge = (Number(issueForm.watch("amount")) || 0) > settings.bankChargeThreshold;
  const issueCharge = issueNeedsCharge ? Math.max(0, Number(issueForm.watch("bankCharge")) || 0) : 0;
  const issueOwed = Math.round((issueTotal + issueCharge) * 100) / 100;
  const issueDate = issueForm.watch("date");
  const issueDueDate = issueDate ? loanDueDate(format(issueDate, "yyyy-MM-dd")) : null;

  const watchedMemberId = paymentForm.watch("memberId");
  // Payments can only be recorded against active loans, so only their borrowers are offered.
  const membersWithActiveLoans = useMemo(() => {
    const borrowerIds = new Set(loans.filter((l) => l.status === "active").map((l) => l.member_id));
    return members.filter((m) => borrowerIds.has(m.id));
  }, [loans, members]);
  const memberLoansForCollection = useMemo(
    () => (watchedMemberId ? loans.filter((l) => l.member_id === watchedMemberId && l.status === "active") : []),
    [watchedMemberId, loans]
  );

  const handleIssueSubmit = async (values: IssueFormValues) => {
    setIsSubmitting(true);
    await issueLoan({
      member_id: values.memberId,
      amount: values.amount,
      loan_date: format(values.date, "yyyy-MM-dd"),
      bank_charge: values.amount > settings.bankChargeThreshold ? Number(values.bankCharge) || 0 : 0,
    });
    setIsSubmitting(false);
    setOpenIssue(false);
    issueForm.reset({ memberId: "", amount: 0, date: new Date(), bankCharge: undefined });
  };

  const handleViewLoan = (loan: LoanWithMember) => setViewLoan(loan);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const defaultKey = defaultDate ? format(defaultDate, "yyyy-MM-dd") : "";
  const defaultProblem = !viewLoan || !defaultKey
    ? "Pick the date the committee decided."
    : defaultKey > todayStr
      ? "The date can't be in the future."
      : defaultKey < viewLoan.loan_date.slice(0, 10)
        ? "The date can't be before the loan was issued."
        : null;

  const handleMarkDefaulted = async () => {
    if (!viewLoan || defaultProblem) return;
    setDefaultSaving(true);
    const ok = await markDefaulted(viewLoan.id, defaultKey);
    setDefaultSaving(false);
    if (ok) { setDefaultOpen(false); setViewLoan(null); }
  };
  const viewDueDate = viewLoan ? loanDueDate(viewLoan.loan_date) : null;
  const viewPenalties = viewLoan ? penalties.filter((p) => p.loan_id === viewLoan.id) : [];
  const viewRepayments = (() => {
    if (!viewLoan) return [];
    const rnd = (n: number) => Math.round(n * 100) / 100;
    const owedBase = Number(viewLoan.total_payable) + (Number(viewLoan.bank_charge) || 0);
    const penaltiesBy = (date: string) => viewPenalties.filter((p) => p.charge_date.slice(0, 10) <= date).reduce((sum, p) => sum + Number(p.amount), 0);
    const paid = installments
      .filter((i) => i.loan_id === viewLoan.id)
      .sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.created_at.localeCompare(b.created_at));
    // Repaid before payments were entered one by one (a loan brought in from the paper registers).
    const repaidInAll = rnd(owedBase + (Number(viewLoan.penalty_total) || 0) - Number(viewLoan.remaining_amount));
    const earlier = rnd(repaidInAll - paid.reduce((sum, i) => sum + Number(i.amount), 0));
    let repaid = 0;
    const rows: { key: string; date: string | null; amount: number; balance: number }[] = [];
    if (earlier > 0.005) {
      repaid = earlier;
      const asAt = (viewLoan.opening_as_at ?? viewLoan.loan_date).slice(0, 10);
      rows.push({ key: "earlier", date: null, amount: earlier, balance: rnd(owedBase + penaltiesBy(asAt) - repaid) });
    }
    for (const i of paid) {
      repaid = rnd(repaid + Number(i.amount));
      rows.push({ key: i.id, date: i.payment_date.slice(0, 10), amount: Number(i.amount), balance: rnd(owedBase + penaltiesBy(i.payment_date.slice(0, 10)) - repaid) });
    }
    return rows;
  })();

  const handleCollectionSubmit = async (values: PaymentFormValues) => {
    setIsSubmitting(true);
    await recordPayment({ loan_id: values.loanId, amount: values.amount, payment_date: format(values.date, "yyyy-MM-dd") });
    setIsSubmitting(false);
    setOpenCollection(false);
    paymentForm.reset({ memberId: "", loanId: "", amount: 0, date: new Date() });
  };

  const { config: books } = useBooksConfig();
  const activeLoans = getActiveLoans();
  const loanStats = getLoanStats();

  // Interest and late penalties on every loan, repaid ones included (rule in utils/loanInterest.ts).
  const incomeRows = useMemo(() => {
    const paymentsByLoan = new Map<string, { date: string; amount: number }[]>();
    for (const i of installments) {
      const list = paymentsByLoan.get(i.loan_id) ?? [];
      list.push({ date: i.payment_date, amount: Number(i.amount) });
      paymentsByLoan.set(i.loan_id, list);
    }
    return loans
      .map((loan) => ({
        loan,
        ...loanIncome({
          loanDate: loan.loan_date,
          amount: Number(loan.amount),
          totalPayable: Number(loan.total_payable),
          bankCharge: Number(loan.bank_charge) || 0,
          remaining: Number(loan.remaining_amount),
          penaltiesCharged: Number(loan.penalty_total) || 0,
          payments: paymentsByLoan.get(loan.id) ?? [],
        }),
      }))
      .filter((x) => x.interest > 0.005 || x.penaltiesCharged > 0.005);
  }, [loans, installments]);
  type IncomeRow = (typeof incomeRows)[number];
  const incomeSum = (rows: IncomeRow[], pick: (x: IncomeRow) => number) =>
    Math.round(rows.reduce((s, x) => s + pick(x), 0) * 100) / 100;
  // Collected: loans repaid in full. Still to collect: the rest, split into active loans
  // (collected when repaid) and defaulted ones.
  const collectedRows = incomeRows.filter((x) => x.receivedOn);
  const openRows = incomeRows.filter((x) => !x.receivedOn && x.loan.status !== "defaulted");
  const defaultedRows = incomeRows.filter((x) => !x.receivedOn && x.loan.status === "defaulted");
  const collectedTotal = incomeSum(collectedRows, (x) => x.interestReceived + x.penaltiesReceived);
  const toCollectTotal = incomeSum(openRows, (x) => x.interestOutstanding + x.penaltiesOutstanding);
  const defaultedTotal = incomeSum(defaultedRows, (x) => x.interestOutstanding + x.penaltiesOutstanding);

  const defaultedLoans = useMemo(
    () => loans
      .filter((l) => l.status === "defaulted")
      .sort((a, b) => String(b.defaulted_on ?? "").localeCompare(String(a.defaulted_on ?? "")) || b.loan_date.localeCompare(a.loan_date)),
    [loans]
  );
  const activePaged = usePaged(activeLoans);
  const defaultedPaged = usePaged(defaultedLoans);
  const repaymentsPaged = usePaged(viewRepayments, viewLoan?.id ?? null);
  const penaltiesPaged = usePaged(viewPenalties, viewLoan?.id ?? null);

  if (isLoading || membersLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-accent/70 pb-4">
        <div className="flex items-center gap-4">
         
          <div>
            <h2 className="text-2xl font-bold text-foreground mt-1">Loan Management</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track and manage member loans</p>
            <AmountsNote />
          </div>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap justify-end gap-2">
            <ViewReportButton request={{ kind: "active-loans" }} label="Active Loans" size="default" />
            <ViewReportButton request={{ kind: "paid-loans" }} label="Paid Loans" size="default" />
            <ViewReportButton request={{ kind: "loan-portfolio" }} label="Loan Portfolio" size="default" />
            {/* Issue Loan Dialog */}
            <Dialog open={openIssue} onOpenChange={(o) => { setOpenIssue(o); if (!o) issueForm.reset({ memberId: "", amount: 0, date: new Date() }); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm rounded-sm"><Plus className="w-4 h-4" /> Issue Loan</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[540px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-sm">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">Issue New Loan</DialogTitle>
                    <p className="text-xs text-muted-foreground">Assign a loan to a member</p>
                  </div>
                </div>
                <Form {...issueForm}>
                  <form onSubmit={issueForm.handleSubmit(handleIssueSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                      <FormField control={issueForm.control} name="memberId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Select Member</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-9 rounded-sm"><SelectValue placeholder="Select a member" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={issueForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Amount</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter amount" className="h-9 rounded-sm figure" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      {issueNeedsCharge && (
                        <FormField control={issueForm.control} name="bankCharge" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Bank charge on this withdrawal</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="From the bank statement" className="h-9 rounded-sm figure" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                              Loans above {settings.bankChargeThreshold.toLocaleString()} are paid by a cheque the bank charges for. The member repays the charge with
                              the loan, with no interest on it. Leave it blank if the statement isn't in yet, and add it later from the loan's View.
                            </p>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={issueForm.control} name="date" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Issue Date</FormLabel>
                          <FormControl>
                            <DatePicker date={field.value} onDateChange={field.onChange} placeholder="Pick a date" disabledThrough={books.cutoverDate} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <div className="rounded-sm border bg-muted/30 px-3.5 py-3 space-y-1.5 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Repayment terms · within {ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS} months</p>
                        <p className="figure">
                          {issueRate > 0 ? `Interest ${issueRate}% flat · ` : ""}Total payable {issueTotal.toLocaleString()}
                          {issueCharge > 0 && <> + bank charge {issueCharge.toLocaleString()} = {issueOwed.toLocaleString()} owed</>}
                          {issueDueDate && <> · due by {format(parseLocalDate(issueDueDate), settings.dateFormat)}</>}
                        </p>
                        <p>Repaid in any amounts, at any time, until it is all paid by the due date.</p>
                        {settings.latePenaltyPerMonth > 0 && (
                          <p className="figure">
                            Late penalty: {settings.latePenaltyPerMonth.toLocaleString()} for each full month unpaid after the due date.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                      <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setOpenIssue(false)}>Cancel</Button>
                      <Button type="submit" size="sm" className="rounded-sm" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Issuing…</> : "Issue Loan"}</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Record Payment Dialog */}
            <Dialog open={openCollection} onOpenChange={(o) => { setOpenCollection(o); if (!o) paymentForm.reset({ memberId: "", loanId: "", amount: 0, date: new Date() }); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-sm"><CheckCircle2 className="w-4 h-4" /> Record Payment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-sm">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-sm border-2 border-secondary/40 bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-foreground">Record Loan Payment</DialogTitle>
                    <p className="text-xs text-muted-foreground">Log a repayment against an active loan</p>
                  </div>
                </div>
                <Form {...paymentForm}>
                  <form onSubmit={paymentForm.handleSubmit(handleCollectionSubmit)} className="flex flex-col min-h-0 flex-1">
                    <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                      <FormField control={paymentForm.control} name="memberId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Select Member</FormLabel>
                          <Select value={field.value} onValueChange={(v) => { field.onChange(v); paymentForm.setValue("loanId", ""); }}>
                            <FormControl>
                              <SelectTrigger className="h-9 rounded-sm"><SelectValue placeholder="Select a member" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {membersWithActiveLoans.length === 0 ? (
                                <SelectItem value="__none" disabled>No members with outstanding loans</SelectItem>
                              ) : (
                                membersWithActiveLoans.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      {watchedMemberId && (
                        <FormField control={paymentForm.control} name="loanId" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Select Loan</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger className="h-9 rounded-sm"><SelectValue placeholder="Select a loan" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>{memberLoansForCollection.map((l) => <SelectItem key={l.id} value={l.id}>Remaining: {l.remaining_amount.toLocaleString()}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Payment Amount</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter payment amount" className="h-9 rounded-sm figure" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={paymentForm.control} name="date" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Payment Date</FormLabel>
                          <FormControl>
                            <DatePicker date={field.value} onDateChange={field.onChange} placeholder="Pick a date" disabledThrough={books.cutoverDate} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                    </div>
                    <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                      <Button type="button" variant="outline" size="sm" className="rounded-sm" onClick={() => setOpenCollection(false)}>Cancel</Button>
                      <Button type="submit" size="sm" className="rounded-sm" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Recording…</> : "Record Payment"}</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Outstanding", value: loanStats.totalOutstanding.toLocaleString(), icon: TrendingDown, color: "border-destructive/40 bg-destructive/10 text-destructive" },
          { label: "Active Loans", value: `${loanStats.activeLoansCount} loan${loanStats.activeLoansCount === 1 ? "" : "s"} · ${loanStats.membersWithLoans} member${loanStats.membersWithLoans === 1 ? "" : "s"}`, icon: HandCoins, color: "border-primary/40 bg-primary/10 text-primary" },
          { label: "Total Recovered", value: loanStats.totalRecovered.toLocaleString(), icon: CheckCircle2, color: "border-secondary/40 bg-secondary/10 text-secondary" },
          { label: "Overdue (past due date)", value: `${loanStats.overdueCount} loan${loanStats.overdueCount === 1 ? "" : "s"} · ${loanStats.overdueAmount.toLocaleString()}`, icon: AlertTriangle, color: "border-accent/60 bg-accent/15 text-accent-foreground dark:text-accent" },
        ].map(({ label, value, icon, color }) => (
          <StatCard key={label} title={label} value={value} icon={icon} iconColor={color} />
        ))}
      </div>

      {/* Active Loans Table */}
      <Card className="shadow-sm rounded-sm border-t-2 border-t-accent">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-primary" />
              </div>
              Active Loans
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeLoans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-sm border-2 border-border bg-muted flex items-center justify-center mx-auto mb-3">
                <HandCoins className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No active loans</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
                <TableHeader>
                  {/* The money columns read left to right as the balance: lent + interest + penalties − repaid. */}
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Member</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-center">Lent</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right"><span className="text-muted-foreground/60 mr-1">+</span>Interest</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right"><span className="text-muted-foreground/60 mr-1">+</span>Penalties</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right"><span className="text-muted-foreground/60 mr-1">−</span>Repaid</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right text-destructive"><span className="text-muted-foreground/60 mr-1">=</span>Outstanding</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Due By</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePaged.rows.map((loan) => {
                    const overdue = isOverdue(loan);
                    const due = dueIn(loanDueDate(loan.loan_date), todayStr);
                    const penaltyTotal = Number(loan.penalty_total) || 0;
                    const interest = Math.round((Number(loan.total_payable) - Number(loan.amount)) * 100) / 100;
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-sm whitespace-nowrap">{loan.member_name || "Unknown"}</TableCell>
                        <TableCell className="text-sm figure text-right whitespace-nowrap">
                          {loan.amount.toLocaleString()}
                          {Number(loan.bank_charge) > 0 && <span className="block text-xs text-muted-foreground" title="Bank charge on the withdrawal, repaid with the loan">+{Number(loan.bank_charge).toLocaleString()} charge</span>}
                        </TableCell>
                        <TableCell className="text-sm figure text-right whitespace-nowrap">
                          {interest > 0.005 ? (
                            <>
                              {interest.toLocaleString()}
                              {/* <span className="block text-xs text-muted-foreground">{Number(loan.interest_rate)}% flat</span> */}
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm figure text-right whitespace-nowrap">{penaltyTotal > 0 ? penaltyTotal.toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-sm figure text-right text-secondary font-medium whitespace-nowrap">{(Math.round((loan.total_payable + (Number(loan.bank_charge) || 0) + penaltyTotal - loan.remaining_amount) * 100) / 100).toLocaleString()}</TableCell>
                        <TableCell className="text-sm figure text-right text-destructive font-bold whitespace-nowrap">
                          {loan.remaining_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col items-start gap-1">
                            <span className={cn("text-muted-foreground figure whitespace-nowrap", overdue && "text-destructive font-semibold")}>
                              {format(parseLocalDate(loanDueDate(loan.loan_date)), settings.dateFormat)}
                            </span>
                            {overdue ? (
                              <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{due.text}</Badge>
                            ) : (
                              <span className="figure text-xs text-muted-foreground whitespace-nowrap">{due.text}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-sm" onClick={() => handleViewLoan(loan)}>
                            <BookOpen className="w-3.5 h-3.5" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <TablePager paged={activePaged} noun="active loans" />
        </CardContent>
      </Card>

      {/* Defaulted Loans: marked defaulted by the committee, so no longer in the active list above.
          Penalties stop on the day a loan was marked; the balance is still owed. */}
      {defaultedLoans.length > 0 && (
        <Card className="shadow-sm rounded-sm border-t-2 border-destructive/60">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm border-2 border-destructive/40 bg-destructive/10 flex items-center justify-center">
                  <Ban className="w-4 h-4 text-destructive" />
                </div>
                Defaulted Loans
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-normal">{defaultedLoans.length} defaulted</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="[&_td]:px-2.5 [&_th]:px-2.5 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:last-child]:pr-5">
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Member</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Lent</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right"><span className="text-muted-foreground/60 mr-1">+</span>Interest</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right"><span className="text-muted-foreground/60 mr-1">+</span>Penalties</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right"><span className="text-muted-foreground/60 mr-1">−</span>Repaid</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right text-destructive"><span className="text-muted-foreground/60 mr-1">=</span>Still owed</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Due By</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Defaulted On</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaultedPaged.rows.map((loan) => {
                    const penaltyTotal = Number(loan.penalty_total) || 0;
                    const interest = Math.round((Number(loan.total_payable) - Number(loan.amount)) * 100) / 100;
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-sm whitespace-nowrap">{loan.member_name || "Unknown"}</TableCell>
                        <TableCell className="text-sm figure text-right whitespace-nowrap">
                          {loan.amount.toLocaleString()}
                          {Number(loan.bank_charge) > 0 && <span className="block text-xs text-muted-foreground" title="Bank charge on the withdrawal, repaid with the loan">+{Number(loan.bank_charge).toLocaleString()} charge</span>}
                        </TableCell>
                        <TableCell className="text-sm figure text-right whitespace-nowrap">
                          {interest > 0.005 ? (
                            <>
                              {interest.toLocaleString()}
                              <span className="block text-xs text-muted-foreground">{Number(loan.interest_rate)}% flat</span>
                            </>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-sm figure text-right whitespace-nowrap">{penaltyTotal > 0 ? penaltyTotal.toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-sm figure text-right text-secondary font-medium whitespace-nowrap">{(Math.round((loan.total_payable + (Number(loan.bank_charge) || 0) + penaltyTotal - loan.remaining_amount) * 100) / 100).toLocaleString()}</TableCell>
                        <TableCell className="text-sm figure text-right text-destructive font-bold whitespace-nowrap">
                          {loan.remaining_amount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground figure whitespace-nowrap">
                          {format(parseLocalDate(loanDueDate(loan.loan_date)), settings.dateFormat)}
                        </TableCell>
                        <TableCell className="text-sm figure whitespace-nowrap">
                          {loan.defaulted_on ? (
                            <span className="font-semibold text-destructive">{format(parseLocalDate(loan.defaulted_on), settings.dateFormat)}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-sm" onClick={() => handleViewLoan(loan)}>
                            <BookOpen className="w-3.5 h-3.5" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <TablePager paged={defaultedPaged} noun="defaulted loans" />
            <p className="text-xs text-muted-foreground px-5 py-3 border-t border-border">
              Marked defaulted by the committee. No late penalty is added after the date a loan was marked defaulted. The balance is still owed by the member and is provided for in full in the accounts from that date.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Interest & Penalties. A loan's interest and penalties are part of its balance (the
          Outstanding column above), not an extra amount owed; they are collected together when the
          loan is repaid in full. Each year's loans are listed on the Profit Distribution page. */}
      <Card className="shadow-sm rounded-sm border-t-2 border-secondary/70">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm border-2 border-secondary/40 bg-secondary/10 flex items-center justify-center">
                <Percent className="w-4 h-4 text-secondary" />
              </div>
              Interest & Penalties
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/profit-distribution"
                className="flex items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Each year's loans on Profit Distribution <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className={cn(
              "grid grid-cols-1 divide-y md:divide-y-0 md:divide-x divide-border",
              defaultedRows.length > 0 ? "md:grid-cols-3" : "md:grid-cols-2"
            )}
          >
            <CollectionFigure
              label="Collected"
              value={collectedTotal.toLocaleString()}
              tone="good"
              note={
                collectedRows.length > 0
                  ? `From ${collectedRows.length} loan${collectedRows.length === 1 ? "" : "s"} repaid in full · interest ${incomeSum(collectedRows, (x) => x.interestReceived).toLocaleString()}, penalties ${incomeSum(collectedRows, (x) => x.penaltiesReceived).toLocaleString()}`
                  : "Nothing yet: no loan with interest has been repaid in full"
              }
            />
            <CollectionFigure
              label="Still to collect"
              value={toCollectTotal.toLocaleString()}
              note={
                openRows.length > 0
                  ? `On ${openRows.length} active loan${openRows.length === 1 ? "" : "s"}, already included in the Outstanding balances above`
                  : "Nothing: every active loan's interest has been collected"
              }
            />
            {defaultedRows.length > 0 && (
              <CollectionFigure
                label="On defaulted loans"
                value={defaultedTotal.toLocaleString()}
                tone="bad"
                note={`${defaultedRows.length} loan${defaultedRows.length === 1 ? "" : "s"} marked defaulted; collected only if repaid in full`}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground px-5 py-3 border-t border-border">
            Interest is added once, when a loan is issued; after the due date a late penalty is added for each full month the loan stays unpaid, until it is marked defaulted.
          </p>
        </CardContent>
      </Card>

      {/* Loan account dialog */}
      <Dialog open={!!viewLoan} onOpenChange={(o) => { if (!o) setViewLoan(null); }}>
        <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden rounded-sm">
          <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
            <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">Loan Account</DialogTitle>
              <p className="text-xs text-muted-foreground figure">
                {viewLoan?.member_name || "Unknown"} · Total Payable {viewLoan?.total_payable?.toLocaleString()}
                {Number(viewLoan?.bank_charge) > 0 && <> + bank charge {Number(viewLoan?.bank_charge).toLocaleString()}</>}
                {viewDueDate && <> · Due by {format(parseLocalDate(viewDueDate), settings.dateFormat)}</>}
                {viewDueDate && viewLoan?.status === "active" && Number(viewLoan.remaining_amount) > 0.005 && <> ({dueIn(viewDueDate, todayStr).text})</>}
              </p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {viewLoan && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { label: "Owed in all", value: Number(viewLoan.total_payable) + (Number(viewLoan.bank_charge) || 0) + (Number(viewLoan.penalty_total) || 0) },
                  { label: "Repaid", value: Number(viewLoan.total_payable) + (Number(viewLoan.bank_charge) || 0) + (Number(viewLoan.penalty_total) || 0) - Number(viewLoan.remaining_amount) },
                  { label: "Outstanding", value: Number(viewLoan.remaining_amount) },
                ].map((f) => (
                  <div key={f.label} className="rounded-sm border border-border/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className={cn("figure text-sm font-bold", f.label === "Outstanding" && f.value > 0.005 ? "text-destructive" : f.label === "Repaid" ? "text-secondary" : "text-foreground")}>
                      {(Math.round(f.value * 100) / 100).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Repayments</p>
            {viewRepayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No repayments yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-right">Balance after</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repaymentsPaged.rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="text-sm figure">{row.date ? format(parseLocalDate(row.date), settings.dateFormat) : "Before the cut-over"}</TableCell>
                      <TableCell className="text-sm figure text-right text-secondary font-medium">{row.amount.toLocaleString()}</TableCell>
                      <TableCell className="text-sm figure text-right">{Math.max(0, row.balance).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <TablePager paged={repaymentsPaged} noun="repayments" className="px-0" />
            {viewLoan && Number(viewLoan.penalty_per_month) > 0 && (
              <p className="text-xs text-muted-foreground mt-3 figure">
                Repaid in any amounts, at any time, until it is all paid by the due date. Late penalty after that: {Number(viewLoan.penalty_per_month).toLocaleString()} for each full month unpaid.
                {viewLoan.status === "defaulted" && viewLoan.defaulted_on && (
                  <> Marked defaulted on {format(parseLocalDate(viewLoan.defaulted_on), settings.dateFormat)}: no penalties after that date.</>
                )}
              </p>
            )}
            {viewPenalties.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive mb-1">Late Penalties</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Month Late</TableHead>
                      <TableHead className="text-xs">Charged On</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {penaltiesPaged.rows.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm figure">{p.penalty_month === 0 ? "From registers" : p.penalty_month}</TableCell>
                        <TableCell className="text-sm figure">{format(parseLocalDate(p.charge_date), settings.dateFormat)}</TableCell>
                        <TableCell className="text-sm figure text-right">{Number(p.amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={2} className="text-sm font-semibold">Total penalties</TableCell>
                      <TableCell className="text-sm figure font-semibold text-right">{(Number(viewLoan?.penalty_total) || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <TablePager paged={penaltiesPaged} noun="penalties" className="px-0" />
              </div>
            )}
          </div>
          {viewLoan && (
            <div className="flex-shrink-0 flex justify-between gap-2 px-6 py-4 border-t bg-muted/20">
              <ViewReportButton request={{ kind: "loan-statement", loanId: viewLoan.id }} label="Loan Account Statement" />
              {isAdmin && viewLoan.status === 'active' && (viewLoan.amount > settings.bankChargeThreshold || Number(viewLoan.bank_charge) > 0) && (
                <Button type="button" variant="outline" size="sm" className="gap-2 rounded-sm ml-auto" onClick={() => { setChargeText(Number(viewLoan.bank_charge) > 0 ? String(viewLoan.bank_charge) : ""); setChargeOpen(true); }}>
                  <Landmark className="w-3.5 h-3.5" /> Bank charge
                </Button>
              )}
              {isAdmin && viewLoan.status !== 'defaulted' && (
                <Button type="button" variant="outline" size="sm" className="gap-2 rounded-sm text-destructive hover:text-destructive" onClick={() => { setDefaultDate(new Date()); setDefaultOpen(true); }}>
                  <Ban className="w-3.5 h-3.5" /> Mark as Defaulted
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Bank charge on this loan's withdrawal</AlertDialogTitle>
            <AlertDialogDescription>
              The amount the bank took for the cheque, as the bank statement shows it. {viewLoan?.member_name || "The member"} repays it with the loan, with no
              interest on it; it is added to the balance owed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Bank charge</p>
            <Input id="bankChargeInput" inputMode="decimal" value={chargeText} onChange={(e) => setChargeText(e.target.value)} className="h-9 rounded-sm figure" placeholder="0" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={chargeSaving}
              onClick={async (e) => {
                e.preventDefault();
                if (!viewLoan) return;
                setChargeSaving(true);
                const ok = await setBankCharge(viewLoan.id, Number(chargeText.replace(/,/g, "")) || 0);
                setChargeSaving(false);
                if (ok) { setChargeOpen(false); setViewLoan(null); }
              }}
              className="rounded-sm"
            >
              {chargeSaving ? "Saving…" : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={defaultOpen} onOpenChange={setDefaultOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this loan as defaulted?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {viewLoan?.member_name || "This member"}'s loan of {Number(viewLoan?.amount ?? 0).toLocaleString()}, with{" "}
                  <span className="figure">{Number(viewLoan?.remaining_amount ?? 0).toLocaleString()}</span> still owed.
                </p>
                <p>
                  No late penalty is added after the date below. Penalties charged up to then stay in the balance, and the accounts
                  provide for the whole balance still owed from that date.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Date the committee decided</p>
            <DatePicker date={defaultDate} onDateChange={setDefaultDate} placeholder="Pick a date" disabledThrough={books.cutoverDate} />
            {defaultProblem && defaultDate && <p className="text-xs text-destructive">{defaultProblem}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleMarkDefaulted(); }}
              disabled={!!defaultProblem || defaultSaving}
              className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {defaultSaving ? "Saving…" : "Mark as defaulted"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CollectionFigure({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "bad" }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("figure text-lg font-bold mt-1", tone === "good" ? "text-secondary" : tone === "bad" ? "text-destructive" : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
    </div>
  );
}
