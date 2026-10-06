import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History, Landmark, Loader2, PieChart, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ViewReportButton from "@/components/ViewReportButton";
import AmountsNote from "@/components/AmountsNote";
import { useOrganization, type ProfitDistribution as Distribution } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBooksConfig } from "@/lib/books";
import { removeBankProfit } from "@/hooks/useBankProfits";
import { buildBooks, type Books } from "@/utils/accounting";
import { planYearEnd, type YearEndPlan, type YearEndRow } from "@/utils/yearEndProfit";
import { cn } from "@/lib/utils";
import { TablePager, usePaged } from "@/components/TablePager";

const EPS = 0.005;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const dayOf = (key: string) => {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
/** The year a distribution is for: its profit year, or (earlier ones) the year it was made. */
const yearOf = (d: Distribution) => d.profitYear ?? Number(String(d.date).slice(0, 4));

/**
 * A saved distribution in the same shape as a preview, so one table and one slip show either.
 * The figures are the ones stored when it was made, not worked out again from today's records.
 */
function savedView(d: Distribution, books: Books, current: YearEndPlan, fineNow: number): YearEndPlan {
  const year = yearOf(d);
  const total = r2(Number(d.totalProfit) || 0);
  const reserve = r2(Number(d.reserveAllocation) || 0);
  const fine = d.absenceFine ?? fineNow;
  const rows: YearEndRow[] = d.memberAllocations
    .map((a) => {
      const dividend = r2(Number(a.amount) || 0);
      const penalty = r2(Number(a.absencePenalty) || 0);
      const absences = Number(a.absences) || 0;
      const gross = r2(a.grossAmount !== undefined ? Number(a.grossAmount) : dividend + penalty);
      const penaltyDue = r2(absences * fine);
      return {
        memberId: a.memberId,
        name: books.memberById.get(a.memberId)?.name ?? a.memberName,
        savings: r2(Number(a.savingsBasis) || 0),
        ratio: Number(a.ratio) || 0,
        gross,
        absences,
        penaltyDue,
        penalty,
        waived: r2(Math.max(0, penaltyDue - penalty)),
        dividend,
      };
    })
    .sort((a, b) => books.memberOrder(a.memberId, b.memberId));
  return {
    year,
    yearStart: `${year}-01-01`,
    yearEnd: `${year}-12-31`,
    bankProfit: r2(Number(d.profitYear ? d.bankProfit : d.totalProfit) || 0),
    loanInterest: r2(Number(d.loanInterest) || 0),
    loanPenalties: r2(Number(d.loanPenalties) || 0),
    collectedLoans: d.profitYear ? current.collectedLoans : [],
    fromRegisters: current.fromRegisters,
    absencePenalties: r2(Number(d.absencePenalties) || 0),
    absences: rows.reduce((s, r) => s + r.absences, 0),
    absenceFine: fine,
    totalProfit: total,
    reservePercent: total > 0 ? Math.round((reserve / total) * 1000) / 10 : 0,
    reserve,
    pool: r2(total - reserve),
    rows,
    totalSavings: r2(rows.reduce((s, r) => s + r.savings, 0)),
    waived: r2(rows.reduce((s, r) => s + r.waived, 0)),
    dividends: r2(rows.reduce((s, r) => s + r.dividend, 0)),
    problems: [],
  };
}

export default function ProfitDistribution() {
  const { members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit, distributeYearEnd, refreshData } = useOrganization();
  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const { config: booksConfig } = useBooksConfig();
  const amount = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (key: string) => format(dayOf(key), settings.dateFormat);

  // The context loads once; make sure loans repaid and contributions recorded elsewhere are in.
  useEffect(() => {
    refreshData().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const books = useMemo(
    () => buildBooks({ members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit }),
    [members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit],
  );

  const thisYear = new Date().getFullYear();
  const history = useMemo(
    () => [...profitDistributions].sort((a, b) => yearOf(b) - yearOf(a) || String(b.date).localeCompare(String(a.date))),
    [profitDistributions],
  );
  const distributedYears = useMemo(() => new Set(history.map(yearOf)), [history]);
  const cutover = booksConfig.cutoverDate;
  // Years that can be shared out: from the first year the app keeps the books to this year.
  const years = useMemo(() => {
    const firstActivityYear = books.firstActivity ? Number(books.firstActivity.slice(0, 4)) : thisYear;
    const firstBookYear = cutover ? Number(cutover.slice(0, 4)) + (cutover.slice(5) === "12-31" ? 1 : 0) : firstActivityYear;
    const from = Math.min(thisYear, cutover ? firstBookYear : firstActivityYear);
    const list = Array.from({ length: thisYear - from + 1 }, (_, i) => thisYear - i);
    for (const y of distributedYears) if (!list.includes(y)) list.push(y);
    // The year in the paper registers whose profit was not yet shared at the cut-over.
    if (openingProfit && !list.includes(openingProfit.year)) list.push(openingProfit.year);
    return list.sort((a, b) => b - a);
  }, [books.firstActivity, cutover, thisYear, distributedYears, openingProfit]);

  const [year, setYear] = useState<number | null>(null);
  // Opens on a finished year still waiting for its AGM; once that is done, on the last distribution.
  const selectedYear =
    year ??
    years.find((y) => y < thisYear && !distributedYears.has(y)) ??
    (history.length ? yearOf(history[0]) : undefined) ??
    years.find((y) => !distributedYears.has(y)) ??
    years[0];
  const [pickedDate, setPickedDate] = useState<Date | undefined>(undefined);
  const [removing, setRemoving] = useState<{ id: string; amount: number; creditedOn: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // The year's bank profit: what was recorded with the meetings (and, for the year in the paper
  // registers, brought in with the opening balances), each dated the day the bank credited it.
  const yearBankProfits = useMemo(() => bankProfits.filter((b) => b.profitYear === selectedYear), [bankProfits, selectedYear]);
  const bankProfit = r2(yearBankProfits.reduce((s, b) => s + b.amount, 0));
  const registers = openingProfit && openingProfit.year === selectedYear
    ? { interest: openingProfit.interest, penalties: openingProfit.penalties, absences: openingProfit.absences }
    : null;
  const plan = useMemo(
    () => planYearEnd(books, {
      year: selectedYear,
      bankProfit,
      reservePercent: settings.reservePercent,
      absenceFine: settings.absencePenaltyPerMeeting,
      registers,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [books, selectedYear, bankProfit, settings.reservePercent, settings.absencePenaltyPerMeeting, openingProfit],
  );
  // A year already distributed shows what was saved; any other year shows the live preview.
  const saved = history.find((d) => yearOf(d) === selectedYear);
  const view = saved ? savedView(saved, books, plan, settings.absencePenaltyPerMeeting) : plan;
  // For the details under the slip: each loan's interest and penalties.
  const loanInterestListed = r2(view.collectedLoans.reduce((s, l) => s + l.interest, 0));
  const loanPenaltiesListed = r2(view.collectedLoans.reduce((s, l) => s + l.penalties, 0));
  const membersPaged = usePaged(view.rows, selectedYear);
  const historyPaged = usePaged(history);
  const bankProfitsPaged = usePaged(yearBankProfits, selectedYear);

  // The AGM is held in July of the following year: default to a July meeting if one is recorded.
  const agmYear = selectedYear + 1;
  const julyMeeting = books.meetings.map((m) => m.date).filter((d) => d.startsWith(`${agmYear}-07`)).sort()[0];
  const dateKey = saved ? String(saved.date).slice(0, 10) : pickedDate ? format(pickedDate, "yyyy-MM-dd") : julyMeeting ?? `${agmYear}-07-01`;
  const yearNotOver = format(new Date(), "yyyy-MM-dd") < `${selectedYear}-12-31`;
  const cutoverInYear = !!cutover && cutover >= `${selectedYear}-01-01` && cutover < `${selectedYear}-12-31`;

  const inputProblems = [
    ...(dateKey <= `${selectedYear}-12-31` ? [`The AGM date must be after the year ends (31/12/${selectedYear}).`] : []),
  ];
  const blockers = saved ? [] : [...inputProblems, ...plan.problems];

  const selectYear = (y: number) => {
    setYear(y);
    setPickedDate(undefined);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const ok = await removeBankProfit(removing.id).catch(() => false);
    setRemoving(null);
    if (ok) {
      toast.success("Bank profit removed");
      await refreshData().catch(() => {});
    } else {
      toast.error("Not removed", { description: "Bank profit can't be removed once its year has been distributed." });
    }
  };

  const run = async () => {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const ok = await distributeYearEnd(plan, dateKey);
      if (ok) {
        setPickedDate(undefined);
        await refreshData().catch(() => {});
      }
    } catch {
      toast.error("Failed to distribute profit");
    } finally {
      setSaving(false);
    }
  };

  const membersPct = Math.round((100 - view.reservePercent) * 10) / 10;

  return (
    <div className="space-y-6">
      {/* Header — statement letterhead */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-accent/70 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground mt-1">Profit Distribution</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each year's profit, from January to December, shared at the Annual General Meeting in July: {settings.reservePercent}% to the reserve fund, the rest to members
          </p>
          <AmountsNote />
        </div>
      </div>

      {/* The year's profit: inputs (or the saved figures) beside the worked-out slip */}
      <Card className="rounded-sm border-t-2 border-t-accent shadow-sm overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <section className="space-y-4 p-5" aria-label="Distribution details">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-bold text-foreground">{saved ? `The ${selectedYear} distribution` : "Distribute a year's profit"}</h3>
            </div>

            <Field label="Year" help={`January to December, shared at the July ${agmYear} AGM.`}>
              <Select value={String(selectedYear)} onValueChange={(v) => selectYear(Number(v))}>
                <SelectTrigger className="h-10 w-44 rounded-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}{distributedYears.has(y) ? " (distributed)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {saved ? (
              <>
                <div className="flex items-start gap-2.5 rounded-sm border border-secondary/40 bg-secondary/10 px-3 py-2.5 text-sm text-foreground">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-secondary mt-0.5" />
                  <p>
                    Distributed at the AGM on <span className="figure font-semibold">{fmt(dateKey)}</span>. These are the figures saved then; a year
                    is distributed only once.
                  </p>
                </div>
                <ViewReportButton request={{ kind: "profit-distribution", distributionId: saved.id }} label="Profit Distribution Statement" size="default" />
              </>
            ) : (
              <>
                <Field
                  label={`Bank profit for ${selectedYear}`}
                  help="Recorded with the meeting at which the bank's profit is reported (Meetings → Add New Meeting), dated the day the bank credited it."
                >
                  {yearBankProfits.length === 0 ? (
                    <p className="rounded-sm border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                      No bank profit recorded for {selectedYear} yet.
                    </p>
                  ) : (
                    <div className="rounded-sm border border-border text-sm">
                      <ul className="divide-y divide-border/60">
                        {bankProfitsPaged.rows.map((b) => (
                          <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                            <Landmark className="w-4 h-4 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                              <p className="figure font-semibold text-foreground">{amount(b.amount)}</p>
                              <p className="text-xs text-muted-foreground">
                                Credited <span className="figure">{fmt(b.creditedOn)}</span> ·{" "}
                                {b.isOpening
                                  ? "from the paper registers"
                                  : b.meetingDate
                                    ? <>recorded at the meeting on <span className="figure">{fmt(b.meetingDate)}</span></>
                                    : "its meeting was deleted"}
                              </p>
                            </div>
                            {isAdmin && !b.isOpening && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-sm text-destructive hover:text-destructive"
                                onClick={() => setRemoving({ id: b.id, amount: b.amount, creditedOn: b.creditedOn })}
                                title="Remove this bank profit"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </li>
                        ))}
                        {yearBankProfits.length > 1 && (
                          <li className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
                            <span>Total</span>
                            <span className="figure">{amount(bankProfit)}</span>
                          </li>
                        )}
                      </ul>
                      <TablePager paged={bankProfitsPaged} noun="bank profits" />
                    </div>
                  )}
                </Field>

                {registers && (
                  <p className="text-xs text-muted-foreground">
                    {selectedYear} is in the paper registers: its loan interest, late penalties and each member's absences are the figures entered with the
                    opening balances.
                  </p>
                )}

                <Field label="AGM date" help={`The Annual General Meeting in July ${agmYear}. Dividends are credited to members' savings on this date.`}>
                  <div className="w-56">
                    <DatePicker
                      date={pickedDate ?? dayOf(dateKey)}
                      onDateChange={setPickedDate}
                      disabledThrough={cutover && cutover > `${selectedYear}-12-31` ? cutover : `${selectedYear}-12-31`}
                      className="h-10 rounded-sm"
                    />
                  </div>
                </Field>

                <p className="text-xs text-muted-foreground">
                  Reserve fund <span className="figure text-foreground">{plan.reservePercent}%</span> of the total; absence charge{" "}
                  <span className="figure text-foreground">{amount(settings.absencePenaltyPerMeeting)}</span> for each meeting missed (Settings → Money rules).
                </p>

                {(yearNotOver || cutoverInYear) && (
                  <div className="flex items-start gap-2.5 rounded-sm border border-accent/50 bg-accent/10 px-3 py-2.5 text-xs text-foreground">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                    <div className="space-y-1">
                      {yearNotOver && <p>{selectedYear} isn't over yet. These figures are to date and will change until 31/12/{selectedYear}.</p>}
                      {cutoverInYear && cutover && (
                        <p>The cut-over ({fmt(cutover)}) is part-way through {selectedYear}. Interest collected before it is in the paper registers and isn't included.</p>
                      )}
                    </div>
                  </div>
                )}

                {blockers.length > 0 && (
                  <ul className="space-y-1 text-xs text-destructive">
                    {blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}

                <Button type="button" onClick={() => setConfirmOpen(true)} disabled={saving || blockers.length > 0} className="w-full gap-2 rounded-sm sm:w-auto">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PieChart className="w-4 h-4" />}
                  {saving ? "Distributing…" : `Distribute the ${selectedYear} profit`}
                </Button>
              </>
            )}
          </section>

          {/* Teller slip: how the year's profit is made up and where it goes */}
          <aside className="border-t border-border p-5 lg:border-t-0 lg:border-l" aria-label={`Profit for ${selectedYear}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-bold text-foreground">Profit for {selectedYear}</h3>
              <div className="flex items-baseline gap-3">
                {saved ? <Badge variant="secondary">Distributed</Badge> : <Badge variant="outline">Preview, not saved</Badge>}
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Line label="Bank profit" value={amount(view.bankProfit)} />
              <Line
                label="Loan interest collected"
                note={view.fromRegisters ? "from the paper registers" : saved ? "loans repaid in full that year" : `${view.collectedLoans.length} loan${view.collectedLoans.length === 1 ? "" : "s"} repaid in full`}
                value={amount(view.loanInterest)}
              />
              <Line label="Late penalties collected" value={amount(view.loanPenalties)} />
              <Line
                label="Absence charges"
                note={`${view.absences} absence${view.absences === 1 ? "" : "s"} × ${amount(view.absenceFine)}, from dividends`}
                value={amount(view.absencePenalties)}
              />
              <Line label="Total profit" value={amount(view.totalProfit)} strong rule="above" />
              <Line label={`Reserve fund (${view.reservePercent}%)`} value={amount(view.reserve)} />
              <Line label={`Members (${membersPct}%)`} value={amount(view.pool)} strong rule="double" />
            </dl>

            <dl className="mt-5 space-y-1.5 text-sm">
              <Line label="Less: absence charges taken from absent members' dividends" value={view.absencePenalties > EPS ? `(${amount(view.absencePenalties)})` : amount(0)} />
              <Line label="Dividends credited to members" value={amount(view.dividends)} tone="good" strong />
            </dl>
            {view.waived > EPS && (
              <p className="mt-2 text-xs text-muted-foreground">
                {amount(view.waived)} of absence charges is waived: a charge is never more than the member's share.
              </p>
            )}

            {view.collectedLoans.length > 0 && (
              <div className="mt-5 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  aria-expanded={showDetails}
                  className="flex items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Details: loans repaid in full in {selectedYear}
                </button>
                {showDetails && (
                  <div className="mt-3 space-y-5">
                    {view.collectedLoans.length > 0 && (
                      <DetailTable
                        caption={`Loans repaid in full in ${selectedYear}`}
                        head={["Loan", "Member", "Repaid on", "Interest", "Penalties"]}
                        numeric={[3, 4]}
                        rows={view.collectedLoans.map((l) => [
                          l.loanNo,
                          l.memberName,
                          fmt(l.repaidOn),
                          amount(l.interest),
                          l.penalties > EPS ? amount(l.penalties) : "—",
                        ])}
                        total={["Total", "", "", amount(loanInterestListed), amount(loanPenaltiesListed)]}
                        noun="loans"
                        resetKey={selectedYear}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">Each member's absences and absence charge are in the Members' dividends table below.</p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </Card>

      {/* Members' dividends: the preview, or the saved figures for a distributed year */}
      <Card className="rounded-sm shadow-sm">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border px-5 py-3.5">
          <CardTitle className="flex items-center gap-2.5 text-base">
            Members' dividends for {selectedYear}
            {saved ? <Badge variant="secondary">Saved {fmt(dateKey)}</Badge> : <Badge variant="outline">Preview</Badge>}
          </CardTitle>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-xs text-muted-foreground">
              {membersPct}% of the total shared by savings on <span className="figure">31/12/{selectedYear}</span>, then each member's absence charges deducted
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {view.rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No member has savings on 31/12/{selectedYear}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-5">Member</TableHead>
                  <TableHead className="h-9 px-3 text-right">Savings on 31/12</TableHead>
                  <TableHead className="h-9 px-3 text-right">Share</TableHead>
                  <TableHead className="h-9 px-3 text-right">Share of {membersPct}%</TableHead>
                  <TableHead className="h-9 px-3 text-right">Absences</TableHead>
                  <TableHead className="h-9 px-3 text-right">Absence charge</TableHead>
                  <TableHead className="h-9 px-5 text-right">Dividend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membersPaged.rows.map((r) => (
                  <TableRow key={r.memberId}>
                    <TableCell className="px-5 py-2 font-medium whitespace-nowrap">{r.name}</TableCell>
                    <TableCell className="figure px-3 py-2 text-right">{r.savings > EPS ? amount(r.savings) : "—"}</TableCell>
                    <TableCell className="figure px-3 py-2 text-right text-muted-foreground">{(r.ratio * 100).toFixed(2)}%</TableCell>
                    <TableCell className="figure px-3 py-2 text-right">{amount(r.gross)}</TableCell>
                    <TableCell className="figure px-3 py-2 text-right">{r.absences || "—"}</TableCell>
                    <TableCell className={cn("figure px-3 py-2 text-right", r.penalty > EPS && "text-destructive")}>
                      {r.penalty > EPS ? `−${amount(r.penalty)}` : "—"}
                      {r.waived > EPS && <span className="block text-xs text-muted-foreground">{amount(r.waived)} waived</span>}
                    </TableCell>
                    <TableCell className="figure px-5 py-2 text-right font-semibold text-secondary">{amount(r.dividend)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="px-5 py-2.5 font-semibold">{view.rows.length} members</TableCell>
                  <TableCell className="figure px-3 py-2.5 text-right font-semibold">{view.totalSavings > EPS ? amount(view.totalSavings) : "—"}</TableCell>
                  <TableCell className="figure px-3 py-2.5 text-right">100.00%</TableCell>
                  <TableCell className="figure px-3 py-2.5 text-right font-semibold">{amount(view.pool)}</TableCell>
                  <TableCell className="figure px-3 py-2.5 text-right">{view.absences}</TableCell>
                  <TableCell className="figure px-3 py-2.5 text-right">{view.absencePenalties > EPS ? `−${amount(view.absencePenalties)}` : "—"}</TableCell>
                  <TableCell className="figure px-5 py-2.5 text-right font-bold">{amount(view.dividends)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
          <TablePager paged={membersPaged} noun="members" />
        </CardContent>
      </Card>

      {/* Distribution history: every part of each year's total, one row per year */}
      {history.length > 0 && (
        <Card className="rounded-sm shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 gap-3 border-b border-border px-5 py-3.5">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-7 h-7 rounded-sm border-2 border-primary/40 bg-primary/10 flex items-center justify-center">
                <History className="w-4 h-4 text-primary" />
              </div>
              Distribution History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9 px-5">Year · AGM</TableHead>
                  <TableHead className="h-9 px-3 text-right">Bank profit</TableHead>
                  <TableHead className="h-9 px-3 text-right"><span className="text-muted-foreground/60 mr-1">+</span>Loan interest</TableHead>
                  <TableHead className="h-9 px-3 text-right"><span className="text-muted-foreground/60 mr-1">+</span>Penalties</TableHead>
                  <TableHead className="h-9 px-3 text-right"><span className="text-muted-foreground/60 mr-1">+</span>Absence charges</TableHead>
                  <TableHead className="h-9 px-3 text-right"><span className="text-muted-foreground/60 mr-1">=</span>Total</TableHead>
                  <TableHead className="h-9 px-3 text-right">Reserve</TableHead>
                  <TableHead className="h-9 px-5 text-right">Dividends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyPaged.rows.map((d) => {
                  const y = yearOf(d);
                  const total = Number(d.totalProfit);
                  const reserve = Number(d.reserveAllocation);
                  const dividends = d.memberAllocations.reduce((s, a) => s + Number(a.amount), 0);
                  const oldMethod = !d.profitYear;
                  const active = y === selectedYear;
                  return (
                    <TableRow
                      key={d.id}
                      onClick={() => selectYear(y)}
                      className={cn("cursor-pointer", active && "bg-primary/5 hover:bg-primary/10")}
                    >
                      <TableCell className="px-5 py-2.5">
                        <p className="figure font-semibold text-foreground">{y}</p>
                        <p className="figure text-xs text-muted-foreground whitespace-nowrap">{fmt(String(d.date))}</p>
                        {oldMethod && <p className="text-xs text-muted-foreground">Old method: bank profit only</p>}
                      </TableCell>
                      <TableCell className="figure px-3 py-2.5 text-right whitespace-nowrap">{amount(oldMethod ? total : Number(d.bankProfit || 0))}</TableCell>
                      <TableCell className="figure px-3 py-2.5 text-right whitespace-nowrap">{oldMethod ? "—" : amount(Number(d.loanInterest || 0))}</TableCell>
                      <TableCell className="figure px-3 py-2.5 text-right whitespace-nowrap">{oldMethod ? "—" : amount(Number(d.loanPenalties || 0))}</TableCell>
                      <TableCell className="figure px-3 py-2.5 text-right whitespace-nowrap">{oldMethod ? "—" : amount(Number(d.absencePenalties || 0))}</TableCell>
                      <TableCell className="figure px-3 py-2.5 text-right font-semibold whitespace-nowrap">{amount(total)}</TableCell>
                      <TableCell className="figure px-3 py-2.5 text-right whitespace-nowrap">
                        {amount(reserve)}
                        <span className="block text-xs text-muted-foreground">{total > 0 ? `${Math.round((reserve / total) * 1000) / 10}%` : ""}</span>
                      </TableCell>
                      <TableCell className="figure px-5 py-2.5 text-right font-semibold text-secondary whitespace-nowrap">
                        {amount(dividends)}
                        <span className="block text-xs font-normal text-muted-foreground">{d.memberAllocations.length} members</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <TablePager paged={historyPaged} noun="distributions" />
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Distribute the {selectedYear} profit?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Total profit {amount(plan.totalProfit)}: {amount(plan.reserve)} ({plan.reservePercent}%) to the reserve fund and {amount(plan.dividends)}{" "}
                  credited to {plan.rows.length} members' savings on {fmt(dateKey)}, after {amount(plan.absencePenalties)} of absence charges.
                </p>
                {plan.bankProfit <= EPS && (
                  <p className="font-medium text-foreground">No bank profit is recorded for {selectedYear}. Go ahead only if there was none.</p>
                )}
                <p>A year can be distributed only once, so check the figures before confirming.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={run} className="rounded-sm">Distribute</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <AlertDialogContent className="rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this bank profit?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && <>{amount(removing.amount)} credited on {fmt(removing.creditedOn)} will be taken out of the {selectedYear} profit and out of Total Budget.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="rounded-sm bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}

function Line({ label, note, value, strong, rule, tone }: { label: string; note?: string; value: string; strong?: boolean; rule?: "above" | "double"; tone?: "good" }) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2",
        rule === "above" && "mt-1.5 border-t border-foreground/60 pt-1.5",
        rule === "double" && "border-b-[3px] border-double border-foreground/60 pb-1",
      )}
    >
      <dt className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className={cn("min-w-0 truncate", strong ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {label}
          {note && <span className="ml-1.5 text-xs text-muted-foreground">({note})</span>}
        </span>
        <span aria-hidden className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-border" />
      </dt>
      <dd className={cn("figure shrink-0", strong ? "font-bold" : "font-medium", tone === "good" ? "text-secondary" : "text-foreground")}>{value}</dd>
    </div>
  );
}

/**
 * A compact register under the slip; `numeric` columns are right-aligned figures, `total` is the
 * ruled last row (for every row, not just the page shown).
 */
function DetailTable({ caption, head, numeric, rows, total, noun, resetKey }: { caption: string; head: string[]; numeric: number[]; rows: string[][]; total: string[]; noun: string; resetKey: number }) {
  const right = (i: number) => numeric.includes(i);
  const paged = usePaged(rows, resetKey);
  return (
    <div>
    <table className="w-full text-xs">
      <caption className="mb-1.5 text-left text-xs font-semibold text-foreground">
        {caption}
      </caption>
      <thead>
        <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} scope="col" className={cn("py-1 font-semibold", i > 0 && "pl-3", right(i) ? "text-right" : "text-left")}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {paged.rows.map((row, r) => (
          <tr key={paged.offset + r} className="border-b border-border/50">
            {row.map((c, i) => (
              <td key={i} className={cn("py-1", i > 0 && "pl-3", right(i) || i === 0 || i === 2 ? "figure" : "", right(i) ? "text-right text-foreground whitespace-nowrap" : i === 1 ? "text-foreground" : "text-muted-foreground whitespace-nowrap")}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-foreground/60 font-semibold text-foreground">
          {total.map((c, i) => (
            <td key={i} className={cn("pt-1.5", i > 0 && "pl-3", right(i) ? "figure text-right whitespace-nowrap" : "")}>{c}</td>
          ))}
        </tr>
      </tfoot>
    </table>
    <TablePager paged={paged} noun={noun} className="mt-2 px-0" />
    </div>
  );
}
