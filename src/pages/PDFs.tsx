import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useSettings } from "@/contexts/SettingsContext";
import { generateReport } from "@/utils/pdfReports";
import { toast } from "sonner";
import {
  FileText,
  Users,
  BookOpen,
  HandCoins,
  PiggyBank,
  BarChart3,
  CalendarDays,
  Download,
  Loader2,
  ClipboardList,
  UserSquare2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReportKey =
  | "member-ledger"
  | "member-directory"
  | "meetings"
  | "contribution-register"
  | "loan-register"
  | "loan-ledger"
  | "reserve-transactions"
  | "financial-summary"
  | "attendance";

export default function PDFsPage() {
  const {
    members,
    meetings,
    reserveFund,
    reserveTransactions,
  } = useOrganization();
  const { settings } = useSettings();

  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedLoanKey, setSelectedLoanKey] = useState<string | null>(null);
  const [loading, setLoading] = useState<ReportKey | null>(null);

  const run = async (key: ReportKey, fn: () => Promise<void>) => {
    setLoading(key);
    try {
      await fn();
      toast.success("Report generated successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(null);
    }
  };

  const loanOptions: { key: string; label: string }[] = [];
  members.forEach((m) =>
    m.loans.forEach((l) =>
      loanOptions.push({
        key: `${m.id}|${l.id}`,
        label: `${m.name} — PKR ${l.amount.toLocaleString()}`,
      })
    )
  );

  const isLoading = (key: ReportKey) => loading === key;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">PDF Reports</h2>
          <p className="text-sm text-muted-foreground">Generate and download official MSO reports</p>
        </div>
      </div>

      {/* Member Reports */}
      <Section title="Member Reports" icon={Users} color="bg-primary/10 text-primary">
        <ReportCard
          icon={BookOpen}
          iconColor="bg-primary/10 text-primary"
          title="Member Ledger"
          description="Full contribution and loan history for a specific member."
          action={
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Select
                value={selectedMemberId ? String(selectedMemberId) : undefined}
                onValueChange={(v) => setSelectedMemberId(v ? Number(v) : null)}
              >
                <SelectTrigger className="w-full sm:w-64 h-9 text-sm ml-12">
                  <SelectValue placeholder="Select a member…" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DownloadButton
                loading={isLoading("member-ledger")}
                onClick={() =>
                  run("member-ledger", async () => {
                    if (!selectedMemberId) throw new Error("Please select a member");
                    const member = members.find((m) => m.id === selectedMemberId);
                    if (!member) throw new Error("Member not found");
                    await generateReport("member-ledger", { member, members }, settings);
                  })
                }
              />
            </div>
          }
        />

        <ReportCard
          icon={UserSquare2}
          iconColor="bg-primary/10 text-primary"
          title="Member Directory"
          description="Complete directory of all registered MSO members."
          action={
            <DownloadButton
              loading={isLoading("member-directory")}
              onClick={() =>
                run("member-directory", () =>
                  generateReport("member-directory", { members }, settings)
                )
              }
            />
          }
        />
      </Section>

      {/* Meetings & Collections */}
      <Section title="Meetings & Collections" icon={CalendarDays} color="bg-secondary/10 text-secondary">
        <ReportCard
          icon={CalendarDays}
          iconColor="bg-secondary/10 text-secondary"
          title="Meetings Ledger"
          description="Record of all meetings including agenda and decisions."
          action={
            <DownloadButton
              loading={isLoading("meetings")}
              onClick={() =>
                run("meetings", () =>
                  generateReport("meetings", { members, meetings }, settings)
                )
              }
            />
          }
        />

        <ReportCard
          icon={ClipboardList}
          iconColor="bg-secondary/10 text-secondary"
          title="Contribution Register"
          description="Monthly contribution records for all members."
          action={
            <DownloadButton
              loading={isLoading("contribution-register")}
              onClick={() =>
                run("contribution-register", () =>
                  generateReport("contribution-register", { members }, settings)
                )
              }
            />
          }
        />
      </Section>

      {/* Loans & Reserve */}
      <Section title="Loans & Reserve" icon={HandCoins} color="bg-rose-500/10 text-rose-600">
        <ReportCard
          icon={HandCoins}
          iconColor="bg-rose-500/10 text-rose-600"
          title="Loan Register"
          description="Overview of all loans issued, outstanding, and recovered."
          action={
            <DownloadButton
              loading={isLoading("loan-register")}
              onClick={() =>
                run("loan-register", () =>
                  generateReport("loan-register", { members }, settings)
                )
              }
            />
          }
        />

        <ReportCard
          icon={BookOpen}
          iconColor="bg-rose-500/10 text-rose-600"
          title="Per-Loan Ledger"
          description="Detailed installment history for a specific loan."
          action={
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Select
                value={selectedLoanKey ?? undefined}
                onValueChange={(v) => setSelectedLoanKey(v ?? null)}
              >
                <SelectTrigger className="w-full sm:w-80 h-9 text-sm">
                  <SelectValue placeholder="Select a loan…" />
                </SelectTrigger>
                <SelectContent>
                  {loanOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>No loans available</SelectItem>
                  ) : (
                    loanOptions.map((o) => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <DownloadButton
                loading={isLoading("loan-ledger")}
                onClick={() =>
                  run("loan-ledger", async () => {
                    if (!selectedLoanKey) throw new Error("Please select a loan");
                    const [memberIdStr, loanIdStr] = selectedLoanKey.split("|");
                    const member = members.find((m) => m.id === Number(memberIdStr));
                    if (!member) throw new Error("Member not found");
                    await generateReport("loan-ledger", { member, members, loanId: Number(loanIdStr) }, settings);
                  })
                }
              />
            </div>
          }
        />

        <ReportCard
          icon={PiggyBank}
          iconColor="bg-rose-500/10 text-rose-600"
          title="Reserve Transactions"
          description="All reserve fund deposits and withdrawals."
          action={
            <DownloadButton
              loading={isLoading("reserve-transactions")}
              onClick={() =>
                run("reserve-transactions", () =>
                  generateReport("reserve-transactions", { transactions: reserveTransactions }, settings)
                )
              }
            />
          }
        />
      </Section>

      {/* Summary Reports */}
      <Section title="Summary Reports" icon={BarChart3} color="bg-accent/20 text-amber-600">
        <ReportCard
          icon={BarChart3}
          iconColor="bg-accent/20 text-amber-600"
          title="Financial Summary"
          description="High-level financial overview including contributions, loans, and reserves."
          action={
            <DownloadButton
              loading={isLoading("financial-summary")}
              onClick={() =>
                run("financial-summary", async () => {
                  const totalContributions = members.reduce(
                    (s, m) => s + m.monthlyContributions.reduce((ss, c) => ss + c.amount, 0), 0
                  );
                  const totalLoans = members.reduce(
                    (s, m) => s + m.loans.reduce((ls, l) => ls + l.amount, 0), 0
                  );
                  const totalLoanRecovered = members.reduce(
                    (s, m) => s + m.loans.reduce((ls, l) => ls + l.installments.reduce((isum, i) => isum + i.amount, 0), 0), 0
                  );
                  await generateReport("financial-summary", {
                    members, totalContributions, totalLoans,
                    totalLoanRecovered, reserveFund,
                    organizationName: settings.organizationName,
                  }, settings);
                })
              }
            />
          }
        />

        <ReportCard
          icon={CalendarDays}
          iconColor="bg-accent/20 text-amber-600"
          title="Attendance Report"
          description="Member attendance records across all meetings."
          action={
            <DownloadButton
              loading={isLoading("attendance")}
              onClick={() =>
                run("attendance", () =>
                  generateReport("attendance", { members }, settings)
                )
              }
            />
          }
        />
      </Section>
    </div>
  );
}

/* ── Sub-components ── */

function Section({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", color.split(" ")[0])}>
          <Icon className={cn("w-4 h-4", color.split(" ")[1])} />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {children}
      </div>
    </div>
  );
}

function ReportCard({
  icon: Icon,
  iconColor,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="card-hover border border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconColor.split(" ")[0])}>
            <Icon className={cn("w-4 h-4", iconColor.split(" ")[1])} />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

function DownloadButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button
      size="sm"
      onClick={onClick}
      disabled={loading}
      className="h-9 gap-2 shadow-sm pt-0 flex items-center justify-center ml-12"
    >
      {loading ? (
        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
      ) : (
        <><Download className="w-3.5 h-3.5" /> Download PDF</>
      )}
    </Button>
  );
}
