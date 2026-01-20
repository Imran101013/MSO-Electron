import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function PDFsPage() {
  const {
    members,
    meetings,
    totalLoanCollected,
    totalLoanOutstanding,
    reserveFund,
    reserveTransactions,
  } = useOrganization();
  const { settings } = useSettings();
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

  const handleMemberLedger = async () => {
    if (!selectedMemberId) {
      toast.error("Please select a member to generate ledger.");
      return;
    }

    const member = members.find((m) => m.id === selectedMemberId);
    if (!member) {
      toast.error("Selected member not found");
      return;
    }

    try {
      await generateReport("member-ledger", { member, members }, settings);
      toast.success("Member ledger generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate member ledger") || "Failed to generate member ledger");
    }
  };

  const handleMeetingsLedger = async () => {
    try {
      await generateReport("meetings", { members, meetings }, settings);
      toast.success("Meetings ledger generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate meetings ledger") || "Failed to generate meetings ledger");
    }
  };

  const handleLoanRegister = async () => {
    try {
      await generateReport("loan-register", { members }, settings);
      toast.success("Loan register generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate loan register") || "Failed to generate loan register");
    }
  };

  // Loan ledger per loan
  const [selectedLoanKey, setSelectedLoanKey] = useState<string | null>(null);

  const loanOptions: { key: string; label: string }[] = [];
  members.forEach((m) => {
    m.loans.forEach((l) => {
      loanOptions.push({
        key: `${m.id}|${l.id}`,
        label: `${m.name} — Loan ${l.id} — PKR ${l.amount.toLocaleString()}`,
      });
    });
  });

  const handleLoanLedger = async () => {
    if (!selectedLoanKey) {
      toast.error("Please select a loan to generate ledger.");
      return;
    }
    const [memberIdStr, loanIdStr] = selectedLoanKey.split("|");
    const memberId = Number(memberIdStr);
    const loanId = Number(loanIdStr);
    const member = members.find((m) => m.id === memberId);
    if (!member) return toast.error("Member not found for selected loan");

    try {
      const loan = member.loans.find((l) => l.id === loanId);
      await generateReport(
        "loan-ledger",
        { member, members, loanId },
        settings
      );
      toast.success("Loan ledger generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate loan ledger") || "Failed to generate loan ledger");
    }
  };

  const handleReserveTransactions = async () => {
    try {
      await generateReport(
        "reserve-transactions",
        { transactions: reserveTransactions },
        settings
      );
      toast.success("Reserve transactions ledger generated");
    } catch (err: unknown) {
      toast.error(
        (err instanceof Error ? err.message : "Failed to generate reserve transactions ledger") || "Failed to generate reserve transactions ledger"
      );
    }
  };

  const handleContributionRegister = async () => {
    try {
      await generateReport("contribution-register", { members }, settings);
      toast.success("Contribution register generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate contribution register") || "Failed to generate contribution register");
    }
  };

  const handleFinancialSummary = async () => {
    try {
      const totalContributions = members.reduce(
        (s, m) =>
          s + m.monthlyContributions.reduce((ss, c) => ss + c.amount, 0),
        0
      );
      const totalLoans = members.reduce(
        (s, m) => s + m.loans.reduce((ls, l) => ls + l.amount, 0),
        0
      );
      const totalLoanRecovered = members.reduce(
        (s, m) =>
          s +
          m.loans.reduce(
            (ls, l) =>
              ls + l.installments.reduce((isum, i) => isum + i.amount, 0),
            0
          ),
        0
      );

      await generateReport(
        "financial-summary",
        {
          members,
          totalContributions,
          totalLoans,
          totalLoanRecovered,
          reserveFund,
          organizationName: settings.organizationName,
        },
        settings
      );
      toast.success("Financial summary generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate financial summary") || "Failed to generate financial summary");
    }
  };

  const handleAttendance = async () => {
    try {
      await generateReport("attendance", { members }, settings);
      toast.success("Attendance report generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate attendance report") || "Failed to generate attendance report");
    }
  };

  const handleMemberDirectory = async () => {
    try {
      await generateReport("member-directory", { members }, settings);
      toast.success("Member directory generated");
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : "Failed to generate member directory") || "Failed to generate member directory");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-semibold text-foreground">PDF Reports</h2>
        <p className="text-muted-foreground">
          Download ledgers MSO reports
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={selectedMemberId ? String(selectedMemberId) : undefined}
              onValueChange={(v) => setSelectedMemberId(v ? Number(v) : null)}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name} — {m.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleMemberLedger}>Download Member Ledger</Button>
            <Button onClick={handleMemberDirectory}>Member Directory</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meetings & Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleMeetingsLedger}>
              Download Meetings Ledger
            </Button>
            <Button onClick={handleContributionRegister}>
              Contribution Register
            </Button>
            <Button onClick={handleLoanRegister}>Loan Register</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per-Loan Ledgers & Reserves</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={selectedLoanKey ?? undefined}
              onValueChange={(v) => setSelectedLoanKey(v ?? null)}>
              <SelectTrigger className="w-96">
                <SelectValue placeholder="Select loan" />
              </SelectTrigger>
              <SelectContent>
                {loanOptions.length === 0 ? (
                  <SelectItem value="__no_loans" disabled>
                    No loans available
                  </SelectItem>
                ) : (
                  loanOptions.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button onClick={handleLoanLedger}>Download Loan Ledger</Button>
            <Button onClick={handleReserveTransactions}>
              Reserve Transactions
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleFinancialSummary}>Financial Summary</Button>
            <Button onClick={handleAttendance}>Attendance Report</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
