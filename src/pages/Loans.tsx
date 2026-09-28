import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, CheckCircle2, Loader2, HandCoins, AlertTriangle, CalendarClock, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import StatCard from "@/components/StatCard";
import ViewReportButton from "@/components/ViewReportButton";
import { useMemo, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLoans, DbLoanScheduleEntry, LoanWithMember, parseLocalDate } from "@/hooks/useLoans";
import { loanDueDate } from "@/utils/loanPenalty";
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const issueSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  amount: z.coerce.number({ invalid_type_error: "Enter a valid amount" }).positive("Amount must be greater than 0"),
  date: z.date({ required_error: "Please pick a date" }),
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
  const { loans, penalties, isLoading, issueLoan, recordPayment, markDefaulted, fetchSchedule, getNextDueDate, getActiveLoans, getLoanStats, isOverdue } = useLoans();
  const { members, isLoading: membersLoading } = useMembers();
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const [openIssue, setOpenIssue] = useState(false);
  const [openCollection, setOpenCollection] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scheduleLoan, setScheduleLoan] = useState<LoanWithMember | null>(null);
  const [scheduleRows, setScheduleRows] = useState<DbLoanScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

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
    });
    setIsSubmitting(false);
    setOpenIssue(false);
    issueForm.reset({ memberId: "", amount: 0, date: new Date() });
  };

  const handleViewSchedule = async (loan: LoanWithMember) => {
    setScheduleLoan(loan);
    setScheduleLoading(true);
    const rows = await fetchSchedule(loan.id);
    setScheduleRows(rows);
    setScheduleLoading(false);
  };

  const handleMarkDefaulted = async () => {
    if (!scheduleLoan) return;
    const ok = await markDefaulted(scheduleLoan.id);
    if (ok) setScheduleLoan(null);
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const scheduleDueDate = scheduleLoan ? loanDueDate(scheduleLoan.loan_date) : null;
  const schedulePenalties = scheduleLoan ? penalties.filter((p) => p.loan_id === scheduleLoan.id) : [];

  const handleCollectionSubmit = async (values: PaymentFormValues) => {
    setIsSubmitting(true);
    await recordPayment({ loan_id: values.loanId, amount: values.amount, payment_date: format(values.date, "yyyy-MM-dd") });
    setIsSubmitting(false);
    setOpenCollection(false);
    paymentForm.reset({ memberId: "", loanId: "", amount: 0, date: new Date() });
  };

  const activeLoans = getActiveLoans();
  const loanStats = getLoanStats();

  if (isLoading || membersLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-primary/40 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
            <HandCoins className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Lending Ledger</p>
            <h2 className="text-2xl font-bold text-foreground mt-1">Loan Management</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Track and manage member loans</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <ViewReportButton request={{ kind: "loan-portfolio" }} label="Loan Portfolio" size="default" />
            {/* Issue Loan Dialog */}
            <Dialog open={openIssue} onOpenChange={(o) => { setOpenIssue(o); if (!o) issueForm.reset({ memberId: "", amount: 0, date: new Date() }); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm rounded-sm"><Plus className="w-4 h-4" /> Issue Loan</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-sm">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Issue New Loan</h2>
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
                          <FormLabel className="text-xs font-medium">Amount ({settings.currency})</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter amount" className="h-9 rounded-sm figure" {...field} />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={issueForm.control} name="date" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Issue Date</FormLabel>
                          <FormControl>
                            <DatePicker date={field.value} onDateChange={field.onChange} placeholder="Pick a date" />
                          </FormControl>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <div className="rounded-sm border bg-muted/30 px-3.5 py-3 space-y-1.5 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">Repayment terms · {ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS} months</p>
                        <p className="figure">
                          {issueRate > 0 ? `Interest ${issueRate}% flat · ` : ""}Total payable {settings.currency} {issueTotal.toLocaleString()}
                          {issueDueDate && <> · due by {format(parseLocalDate(issueDueDate), settings.dateFormat)}</>}
                        </p>
                        <p className="figure">
                          Repay in {ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS} monthly instalments of about {settings.currency} {(Math.round((issueTotal / ORGANIZATION_CONFIG.LOAN_PERIOD_MONTHS) * 100) / 100).toLocaleString()}, or as a lump sum at any time before the due date.
                        </p>
                        {settings.latePenaltyPerMonth > 0 && (
                          <p className="figure">
                            A penalty of {settings.currency} {settings.latePenaltyPerMonth.toLocaleString()} is charged for each full month the loan is still unpaid after the due date.
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
                    <h2 className="text-base font-bold text-foreground">Record Loan Payment</h2>
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
                              <SelectContent>{memberLoansForCollection.map((l) => <SelectItem key={l.id} value={l.id}>Remaining: {settings.currency} {l.remaining_amount.toLocaleString()}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Payment Amount ({settings.currency})</FormLabel>
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
                            <DatePicker date={field.value} onDateChange={field.onChange} placeholder="Pick a date" />
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
          { label: "Total Outstanding", value: `${settings.currency} ${loanStats.totalOutstanding.toLocaleString()}`, icon: TrendingDown, color: "border-destructive/40 bg-destructive/10 text-destructive" },
          { label: "Active Loans", value: `${loanStats.activeLoansCount} loans · ${loanStats.membersWithLoans} members`, icon: HandCoins, color: "border-primary/40 bg-primary/10 text-primary" },
          { label: "Total Recovered", value: `${settings.currency} ${loanStats.totalRecovered.toLocaleString()}`, icon: CheckCircle2, color: "border-secondary/40 bg-secondary/10 text-secondary" },
          { label: "Overdue (past due date)", value: `${loanStats.overdueCount} loans · ${settings.currency} ${loanStats.overdueAmount.toLocaleString()}`, icon: AlertTriangle, color: "border-accent/50 bg-accent/15 text-accent-foreground" },
        ].map(({ label, value, icon, color }) => (
          <StatCard key={label} title={label} value={value} icon={icon} iconColor={color} />
        ))}
      </div>

      {/* Active Loans Table */}
      <Card className="shadow-sm rounded-sm border-t-2 border-primary/70">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-primary" />
              </div>
              Active Loans
            </div>
            {activeLoans.length > 0 && (
              <Badge variant="outline" className="font-normal">{activeLoans.length} active</Badge>
            )}
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
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Member</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Issued</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Paid</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-destructive">Remaining</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Next Instalment</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Due By</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Schedule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLoans.map((loan) => {
                    const nextDue = getNextDueDate(loan.id);
                    const overdue = isOverdue(loan);
                    const penaltyTotal = Number(loan.penalty_total) || 0;
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-sm">{loan.member_name || "Unknown"}</TableCell>
                        <TableCell className="text-sm figure">{settings.currency} {loan.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-sm figure text-secondary font-medium">{settings.currency} {(Math.round((loan.total_payable + penaltyTotal - loan.remaining_amount) * 100) / 100).toLocaleString()}</TableCell>
                        <TableCell className="text-sm figure text-destructive font-bold">
                          {settings.currency} {loan.remaining_amount.toLocaleString()}
                          {penaltyTotal > 0 && <p className="text-xs font-normal text-muted-foreground">incl. {settings.currency} {penaltyTotal.toLocaleString()} penalty</p>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground figure">
                          {nextDue && !overdue ? format(parseLocalDate(nextDue), settings.dateFormat) : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-muted-foreground figure", overdue && "text-accent-foreground font-semibold")}>
                              {format(parseLocalDate(loanDueDate(loan.loan_date)), settings.dateFormat)}
                            </span>
                            {overdue && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Overdue</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-sm" onClick={() => handleViewSchedule(loan)}>
                            <CalendarClock className="w-3.5 h-3.5" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleLoan} onOpenChange={(o) => { if (!o) setScheduleLoan(null); }}>
        <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden rounded-sm">
          <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
            <div className="w-10 h-10 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Repayment Schedule</h2>
              <p className="text-xs text-muted-foreground figure">
                {scheduleLoan?.member_name || "Unknown"} · Total Payable {settings.currency} {scheduleLoan?.total_payable?.toLocaleString()}
                {scheduleDueDate && <> · Due by {format(parseLocalDate(scheduleDueDate), settings.dateFormat)}</>}
              </p>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-5">
            {scheduleLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">#</TableHead>
                    <TableHead className="text-xs">Due Date</TableHead>
                    <TableHead className="text-xs">Due</TableHead>
                    <TableHead className="text-xs">Paid</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduleRows.map((row) => {
                    const overdue = row.status === 'pending' && !!scheduleDueDate && scheduleDueDate < todayStr;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm figure">{row.installment_number}</TableCell>
                        <TableCell className="text-sm figure">{format(parseLocalDate(row.due_date), settings.dateFormat)}</TableCell>
                        <TableCell className="text-sm figure">{settings.currency} {Number(row.due_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm figure">{settings.currency} {Number(row.paid_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                          {row.status === 'paid' ? (
                            <Badge variant="secondary">Paid</Badge>
                          ) : overdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {scheduleLoan && Number(scheduleLoan.penalty_per_month) > 0 && (
              <p className="text-xs text-muted-foreground mt-3 figure">
                Instalments are a guide; the loan may also be repaid as a lump sum before the due date. After that, {settings.currency} {Number(scheduleLoan.penalty_per_month).toLocaleString()} is charged for each full month it remains unpaid.
              </p>
            )}
            {!scheduleLoading && schedulePenalties.length > 0 && (
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
                    {schedulePenalties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm figure">{p.penalty_month}</TableCell>
                        <TableCell className="text-sm figure">{format(parseLocalDate(p.charge_date), settings.dateFormat)}</TableCell>
                        <TableCell className="text-sm figure text-right">{settings.currency} {Number(p.amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={2} className="text-sm font-semibold">Total penalties</TableCell>
                      <TableCell className="text-sm figure font-semibold text-right">{settings.currency} {(Number(scheduleLoan?.penalty_total) || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          {scheduleLoan && (
            <div className="flex-shrink-0 flex justify-between gap-2 px-6 py-4 border-t bg-muted/20">
              <ViewReportButton request={{ kind: "loan-statement", loanId: scheduleLoan.id }} label="Loan Statement" />
              {isAdmin && scheduleLoan.status !== 'defaulted' && (
                <Button type="button" variant="outline" size="sm" className="gap-2 rounded-sm text-destructive hover:text-destructive" onClick={handleMarkDefaulted}>
                  <Ban className="w-3.5 h-3.5" /> Mark as Defaulted
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
