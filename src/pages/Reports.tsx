import React, { useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { buildBooks, parseDay, todayKey, type ReportPeriod } from "@/utils/accounting";
import { type ReportKind, type ReportRequest } from "@/utils/pdfReports";
import { useReportViewer } from "@/contexts/ReportViewerContext";
import { toast } from "sonner";
import {
  FileText,
  Users,
  BookOpen,
  HandCoins,
  PiggyBank,
  CalendarDays,
  Eye,
  ClipboardList,
  UserSquare2,
  Landmark,
  Scale,
  BookText,
  PieChart,
  CalendarRange,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PeriodPreset = "all" | "this-year" | "last-year" | "this-month" | "last-month" | "custom";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "all", label: "Since inception" },
  { value: "this-year", label: "This year to date" },
  { value: "last-year", label: "Last financial year" },
  { value: "this-month", label: "This month to date" },
  { value: "last-month", label: "Last month" },
  { value: "custom", label: "Custom period" },
];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function resolvePeriod(preset: PeriodPreset, from?: Date, to?: Date): ReportPeriod {
  const today = todayKey();
  const now = new Date();
  const y = now.getFullYear();
  switch (preset) {
    case "this-year":
      return { from: `${y}-01-01`, to: today };
    case "last-year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "this-month":
      return { from: iso(startOfMonth(now)), to: today };
    case "last-month": {
      const prev = subMonths(now, 1);
      return { from: iso(startOfMonth(prev)), to: iso(endOfMonth(prev)) };
    }
    case "custom":
      return { from: from ? iso(from) : null, to: to ? iso(to) : today };
    default:
      return { from: null, to: today };
  }
}

type Scope = "period" | "as-at" | "distribution";

export default function ReportsPage() {
  const { members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit, refreshData } = useOrganization();
  const { settings } = useSettings();
  const { openReport } = useReportViewer();

  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedDistributionId, setSelectedDistributionId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);

  // Reload records on open so the member, loan and distribution pickers are current. (The viewer
  // reloads again before building each report.)
  useEffect(() => {
    let active = true;
    refreshData().finally(() => active && setRefreshing(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One derived ledger feeds every report so figures agree across documents.
  const books = useMemo(
    () => buildBooks({ members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit }),
    [members, meetings, reserveTransactions, profitDistributions, bankProfits, openingProfit],
  );

  const period = resolvePeriod(preset, customFrom, customTo);
  const periodInvalid = !!period.from && period.from > period.to;
  const fmt = (key: string) => format(parseDay(key), settings.dateFormat || "dd/MM/yyyy");
  const periodText = period.from ? `${fmt(period.from)} – ${fmt(period.to)}` : `Inception – ${fmt(period.to)}`;
  const scopeText = (scope: Scope) =>
    scope === "period" ? `Period · ${periodText}` : scope === "as-at" ? `As at · ${fmt(period.to)}` : "Per distribution";

  const view = (kind: ReportKind, extra: Omit<ReportRequest, "kind" | "period"> = {}) => {
    if (periodInvalid) {
      toast.error("The period start date is after its end date");
      return;
    }
    openReport({ kind, period, ...extra });
  };

  const card = (kind: ReportKind, scope: Scope, props: Omit<ReportCardProps, "scope" | "action">, extra?: Omit<ReportRequest, "kind" | "period">, selector?: React.ReactNode, disabled?: boolean) => (
    <ReportCard
      {...props}
      scope={scopeText(scope)}
      action={
        <div className="flex flex-col sm:flex-row gap-3">
          {selector}
          <ViewButton disabled={disabled} onClick={() => view(kind, extra)} />
        </div>
      }
    />
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-sm border-2 border-primary/50 bg-primary/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="tracked-label text-[10px] font-semibold text-primary uppercase">Reports & Documents</p>
          <h2 className="text-2xl font-bold text-foreground mt-1">Reports</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Financial statements, ledgers and registers on the MSO letterhead. View a report, then download it from the viewer.
          </p>
        </div>
      </div>

      {/* Reporting period */}
      <Card className="border border-border/60 shadow-sm rounded-sm ledger-rule">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-sm border-2 border-primary/40 bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <CalendarRange className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Reporting period</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Period reports cover the selected dates with balances brought forward. As-at reports show the position at the end date.
              </p>
            </div>
          </div>
          <div className="pl-12 flex flex-col lg:flex-row lg:items-center gap-3">
            <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
              <SelectTrigger className="w-full lg:w-56 h-9 text-sm rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {preset === "custom" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <DatePicker date={customFrom} onDateChange={setCustomFrom} placeholder="From (inception)" className="h-9 sm:w-52 rounded-sm" />
                <DatePicker date={customTo} onDateChange={setCustomTo} placeholder="To (today)" className="h-9 sm:w-52 rounded-sm" />
              </div>
            )}
            <p className={cn("figure text-xs lg:ml-auto", periodInvalid ? "text-destructive" : "text-muted-foreground")}>
              {refreshing ? "Loading latest records…" : periodInvalid ? "Start date is after end date" : periodText}
            </p>
          </div>
        </CardContent>
      </Card>

      <Section title="Financial Statements" icon={Landmark}>
        {card("financial-statements", "period", {
          icon: Landmark,
          title: "Financial Statements",
          description: "Financial position, income & expenditure, changes in funds, cash flows, notes and approval page.",
        })}
        {card("trial-balance", "as-at", {
          icon: Scale,
          title: "Trial Balance",
          description: "Debit and credit balances of every account, proving the books agree.",
        })}
        {card("cash-book", "period", {
          icon: BookText,
          title: "Cash Book",
          description: "Every receipt and payment by voucher, with running cash balance.",
        })}
      </Section>

      <Section title="Member Accounts" icon={Users}>
        {card(
          "member-statement",
          "period",
          {
            icon: BookOpen,
            title: "Member Account Statement",
            description: "Savings and loan accounts for one member, with balances brought forward.",
          },
          { memberId: selectedMemberId ?? undefined },
          <Select value={selectedMemberId ?? undefined} onValueChange={(v) => setSelectedMemberId(v || null)}>
            <SelectTrigger className="w-full sm:w-56 h-9 text-sm rounded-sm">
              <SelectValue placeholder="Select a member…" />
            </SelectTrigger>
            <SelectContent>
              {books.members.map((m) => (
                <SelectItem key={m.dbId} value={m.dbId}>{m.memberNo} · {m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>,
          !selectedMemberId,
        )}
        {card("member-register", "as-at", {
          icon: UserSquare2,
          title: "Register of Members",
          description: "Members in order of admission with contact details and balances.",
        })}
      </Section>

      <Section title="Loans" icon={HandCoins}>
        {card("loan-portfolio", "as-at", {
          icon: HandCoins,
          title: "Loan Portfolio",
          description: "All loans with due dates, penalties and balances, plus interest and penalties charged, received and outstanding.",
        })}
        {card(
          "loan-statement",
          "as-at",
          {
            icon: BookOpen,
            title: "Loan Account Statement",
            description: "Terms, interest and penalties, repayment schedule and account transactions for one loan.",
          },
          { loanId: selectedLoanId ?? undefined },
          <Select value={selectedLoanId ?? undefined} onValueChange={(v) => setSelectedLoanId(v || null)}>
            <SelectTrigger className="w-full sm:w-64 h-9 text-sm rounded-sm">
              <SelectValue placeholder="Select a loan…" />
            </SelectTrigger>
            <SelectContent>
              {books.loans.length === 0 ? (
                <SelectItem value="__none" disabled>No loans available</SelectItem>
              ) : (
                [...books.loans].reverse().map((l) => (
                  <SelectItem key={l.dbId} value={l.dbId}>
                    {l.loanNo} · {l.memberName} · {settings.currency} {l.principal.toLocaleString()}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>,
          !selectedLoanId,
        )}
      </Section>

      <Section title="Funds & Collections" icon={PiggyBank}>
        {card("contribution-register", "period", {
          icon: ClipboardList,
          title: "Contribution Register",
          description: "Receipts by month with subtotals, plus a per-member summary.",
        })}
        {card("reserve-ledger", "period", {
          icon: PiggyBank,
          title: "Reserve Fund Ledger",
          description: "Donations, profit allocations and expenses with running fund balance.",
        })}
        {card(
          "profit-distribution",
          "distribution",
          {
            icon: PieChart,
            title: "Profit Distribution Statement",
            description: "How the year's profit is made up, the reserve fund's share and each member's dividend after absence charges.",
          },
          { distributionId: selectedDistributionId ?? undefined },
          <Select value={selectedDistributionId ?? undefined} onValueChange={(v) => setSelectedDistributionId(v || null)}>
            <SelectTrigger className="w-full sm:w-56 h-9 text-sm rounded-sm">
              <SelectValue placeholder={books.distributions.length ? "Latest distribution" : "None recorded"} />
            </SelectTrigger>
            <SelectContent>
              {books.distributions.length === 0 ? (
                <SelectItem value="__none" disabled>No distributions recorded</SelectItem>
              ) : (
                [...books.distributions].reverse().map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.voucher} · {fmt(d.date.slice(0, 10))} · {settings.currency} {d.totalProfit.toLocaleString()}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>,
          books.distributions.length === 0,
        )}
      </Section>

      <Section title="Governance" icon={CalendarDays}>
        {card("meetings-register", "period", {
          icon: CalendarDays,
          title: "Meetings & Attendance Register",
          description: "Agenda, resolutions, attendance and collections for each meeting.",
        })}
      </Section>
    </div>
  );
}

/* ── Sub-components ── */

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-sm border-2 border-primary/40 bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

interface ReportCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  scope: string;
  action: React.ReactNode;
}

function ReportCard({ icon: Icon, title, description, scope, action }: ReportCardProps) {
  return (
    <Card className="card-hover border border-border/60 shadow-sm rounded-sm">
      <CardContent className="p-5 h-full flex flex-col">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-sm border-2 border-primary/40 bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
            <p className="tracked-label text-[10px] text-primary uppercase mt-2">{scope}</p>
          </div>
        </div>
        <div className="pl-12 mt-auto">{action}</div>
      </CardContent>
    </Card>
  );
}

function ViewButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="sm" onClick={onClick} disabled={disabled} className="h-9 gap-2 shadow-sm flex items-center justify-center rounded-sm">
      <Eye className="w-3.5 h-3.5" /> View
    </Button>
  );
}
