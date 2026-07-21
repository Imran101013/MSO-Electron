import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingDown, CheckCircle2, Loader2, HandCoins, AlertTriangle, CalendarClock, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORGANIZATION_CONFIG } from "@/config/organization";
import StatCard from "@/components/StatCard";
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
import { useMembers } from "@/hooks/useMembers";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const issueSchema = z.object({
  memberId: z.string().min(1, "Please select a member"),
  amount: z.coerce.number({ invalid_type_error: "Enter a valid amount" }).positive("Amount must be greater than 0"),
  date: z.date({ required_error: "Please pick a date" }),
  termMonths: z.coerce.number({ invalid_type_error: "Enter a valid term" }).int("Must be a whole number").min(1, "At least 1 month"),
});
type IssueFormValues = z.infer<typeof issueSchema>;

const buildPaymentSchema = (maxAmount: number) =>
  z.object({
    memberId: z.string().min(1, "Please select a member"),
    loanId: z.string().min(1, "Please select a loan"),
    amount: z.coerce
      .number({ invalid_type_error: "Enter a valid amount" })
      .positive("Amount must be greater than 0")
      .max(maxAmount, `Cannot exceed remaining balance of PKR ${maxAmount.toLocaleString()}`),
    date: z.date({ required_error: "Please pick a date" }),
  });
type PaymentFormValues = z.infer<ReturnType<typeof buildPaymentSchema>>;

export default function Loans() {
  const { loans, isLoading, issueLoan, recordPayment, markDefaulted, fetchSchedule, getNextDueDate, getActiveLoans, getLoanStats } = useLoans();
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
    defaultValues: { memberId: "", amount: 0, date: new Date(), termMonths: ORGANIZATION_CONFIG.DEFAULT_LOAN_TERM_MONTHS },
  });

  const paymentForm = useForm<PaymentFormValues>({
    resolver: (values, context, options) => {
      const selectedLoan = loans.find((l) => l.id === (values as PaymentFormValues).loanId);
      const schema = buildPaymentSchema(selectedLoan?.remaining_amount ?? Number.MAX_SAFE_INTEGER);
      return zodResolver(schema)(values, context, options);
    },
    defaultValues: { memberId: "", loanId: "", amount: 0, date: new Date() },
  });

  const watchedMemberId = paymentForm.watch("memberId");
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
      term_months: values.termMonths,
    });
    setIsSubmitting(false);
    setOpenIssue(false);
    issueForm.reset({ memberId: "", amount: 0, date: new Date(), termMonths: ORGANIZATION_CONFIG.DEFAULT_LOAN_TERM_MONTHS });
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md">
            <HandCoins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Loan Management</h2>
            <p className="text-sm text-muted-foreground">Track and manage member loans</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {/* Issue Loan Dialog */}
            <Dialog open={openIssue} onOpenChange={(o) => { setOpenIssue(o); if (!o) issueForm.reset({ memberId: "", amount: 0, date: new Date(), termMonths: ORGANIZATION_CONFIG.DEFAULT_LOAN_TERM_MONTHS }); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm rounded-xl"><Plus className="w-4 h-4" /> Issue Loan</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
                    <Plus className="w-5 h-5 text-white" />
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
                              <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select a member" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>{members.filter((m) => m.is_approved).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                      <FormField control={issueForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Amount (PKR)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter amount" className="h-9 rounded-xl" {...field} />
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
                      <FormField control={issueForm.control} name="termMonths" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Term (months)</FormLabel>
                          <FormControl>
                            <Input type="number" min={1} placeholder="Number of monthly installments" className="h-9 rounded-xl" {...field} />
                          </FormControl>
                          {settings.applyLoanInterest && (
                            <p className="text-xs text-muted-foreground">Interest ({settings.loanInterestRate}%) will be added and split evenly across the term.</p>
                          )}
                          <FormMessage className="text-xs" />
                        </FormItem>
                      )} />
                    </div>
                    <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t bg-muted/20">
                      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOpenIssue(false)}>Cancel</Button>
                      <Button type="submit" size="sm" className="rounded-xl" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Issuing…</> : "Issue Loan"}</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Record Payment Dialog */}
            <Dialog open={openCollection} onOpenChange={(o) => { setOpenCollection(o); if (!o) paymentForm.reset({ memberId: "", loanId: "", amount: 0, date: new Date() }); }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl"><CheckCircle2 className="w-4 h-4" /> Record Payment</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[460px] flex flex-col max-h-[90vh] p-0 gap-0 overflow-hidden rounded-2xl">
                {/* Header */}
                <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-md flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
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
                              <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select a member" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>{members.filter((m) => m.is_approved).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
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
                                <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Select a loan" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>{memberLoansForCollection.map((l) => <SelectItem key={l.id} value={l.id}>Remaining: PKR {l.remaining_amount.toLocaleString()}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )} />
                      )}
                      <FormField control={paymentForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Payment Amount (PKR)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter payment amount" className="h-9 rounded-xl" {...field} />
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
                      <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setOpenCollection(false)}>Cancel</Button>
                      <Button type="submit" size="sm" className="rounded-xl" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Recording…</> : "Record Payment"}</Button>
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
          { label: "Total Outstanding", value: `PKR ${loanStats.totalOutstanding.toLocaleString()}`, icon: TrendingDown, color: "bg-rose-500" },
          { label: "Active Loans", value: `${loanStats.activeLoansCount} loans · ${loanStats.membersWithLoans} members`, icon: HandCoins, color: "bg-gradient-primary" },
          { label: "Total Recovered", value: `PKR ${loanStats.totalRecovered.toLocaleString()}`, icon: CheckCircle2, color: "bg-emerald-500" },
          { label: "Overdue", value: `${loanStats.overdueCount} loans · PKR ${loanStats.overdueAmount.toLocaleString()}`, icon: AlertTriangle, color: "bg-amber-500" },
        ].map(({ label, value, icon, color }) => (
          <StatCard key={label} title={label} value={value} icon={icon} iconColor={color} />
        ))}
      </div>

      {/* Active Loans Table */}
      <Card className="shadow-md border-0 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <HandCoins className="w-4 h-4 text-primary" />
              </div>
              Active Loans
            </div>
            {activeLoans.length > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full font-normal">{activeLoans.length} active</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeLoans.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
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
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-rose-600">Remaining</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">Next Due</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">Schedule</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLoans.map((loan) => {
                    const nextDue = getNextDueDate(loan.id);
                    const isOverdue = !!nextDue && nextDue < todayStr;
                    return (
                      <TableRow key={loan.id} className="hover:bg-muted/30">
                        <TableCell className="font-semibold text-sm">{loan.member_name || "Unknown"}</TableCell>
                        <TableCell className="text-sm">PKR {loan.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">PKR {(loan.amount - loan.remaining_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-rose-600 dark:text-rose-400 font-bold">PKR {loan.remaining_amount.toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                          {nextDue ? (
                            <div className="flex items-center gap-2">
                              <span className={cn("text-muted-foreground", isOverdue && "text-amber-600 dark:text-amber-400 font-semibold")}>
                                {format(parseLocalDate(nextDue), settings.dateFormat)}
                              </span>
                              {isOverdue && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Overdue</Badge>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="gap-1.5 rounded-xl" onClick={() => handleViewSchedule(loan)}>
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
        <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden rounded-2xl">
          <div className="flex items-center gap-4 px-6 py-5 border-b bg-muted/30 flex-shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-md flex-shrink-0">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Repayment Schedule</h2>
              <p className="text-xs text-muted-foreground">{scheduleLoan?.member_name || "Unknown"} · Total Payable PKR {scheduleLoan?.total_payable?.toLocaleString()}</p>
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
                    const overdue = row.status === 'pending' && row.due_date < todayStr;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm">{row.installment_number}</TableCell>
                        <TableCell className="text-sm">{format(parseLocalDate(row.due_date), settings.dateFormat)}</TableCell>
                        <TableCell className="text-sm">PKR {Number(row.due_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">PKR {Number(row.paid_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-sm">
                          {row.status === 'paid' ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-500">Paid</Badge>
                          ) : overdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          {isAdmin && scheduleLoan && scheduleLoan.status !== 'defaulted' && (
            <div className="flex-shrink-0 flex justify-end px-6 py-4 border-t bg-muted/20">
              <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl text-destructive hover:text-destructive" onClick={handleMarkDefaulted}>
                <Ban className="w-3.5 h-3.5" /> Mark as Defaulted
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
