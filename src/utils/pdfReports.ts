import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Member, MonthlyContribution } from "@/contexts/OrganizationContext";
import { formatDate } from "@/lib/utils";

export interface ReportData {
  members: Member[];
  totalContributions: number;
  totalLoans: number;
  totalLoanRecovered: number;
  reserveFund: number;
  organizationName: string;
  currentDate: string;
}

export interface Settings {
  applyLoanInterest: boolean;
  loanInterestRate: number;
}

export class PDFReports {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private currentY: number;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
  }

  private addHeader(title: string, organizationName: string) {
    // Organization name
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(organizationName, this.pageWidth / 2, this.currentY, {
      align: "center",
    });
    this.currentY += 10;

    // Report title
    this.doc.setFontSize(14);
    this.doc.text(title, this.pageWidth / 2, this.currentY, {
      align: "center",
    });
    this.currentY += 10;

    // Date
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(
      `Generated on: ${formatDate(new Date())}`,
      this.pageWidth / 2,
      this.currentY,
      { align: "center" }
    );
    this.currentY += 15;

    // Add a line
    this.doc.setLineWidth(0.5);
    this.doc.line(
      this.margin,
      this.currentY,
      this.pageWidth - this.margin,
      this.currentY
    );
    this.currentY += 10;
  }

  private checkPageBreak(requiredSpace: number = 20) {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.currentY = this.margin;
    }
  }

  private addTable(headers: string[], data: string[][], startY?: number) {
    const tableStartY = startY || this.currentY;
    let currentY = tableStartY;

    // Calculate column widths
    const colWidth = (this.pageWidth - 2 * this.margin) / headers.length;

    // Header
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFillColor(240, 240, 240);
    this.doc.rect(
      this.margin,
      currentY,
      this.pageWidth - 2 * this.margin,
      8,
      "F"
    );

    headers.forEach((header, index) => {
      this.doc.text(header, this.margin + index * colWidth + 2, currentY + 6);
    });
    currentY += 8;

    // Data rows
    this.doc.setFont("helvetica", "normal");
    data.forEach((row, rowIndex) => {
      this.checkPageBreak(8);
      if (this.currentY !== currentY) {
        currentY = this.currentY;
        // Re-draw header if page break occurred
        this.doc.setFont("helvetica", "bold");
        this.doc.setFillColor(240, 240, 240);
        this.doc.rect(
          this.margin,
          currentY,
          this.pageWidth - 2 * this.margin,
          8,
          "F"
        );
        headers.forEach((header, index) => {
          this.doc.text(
            header,
            this.margin + index * colWidth + 2,
            currentY + 6
          );
        });
        currentY += 8;
        this.doc.setFont("helvetica", "normal");
      }

      row.forEach((cell, colIndex) => {
        this.doc.text(
          cell.toString(),
          this.margin + colIndex * colWidth + 2,
          currentY + 6
        );
      });
      currentY += 8;
    });

    this.currentY = currentY + 5;
  }

  generateMemberLedger(member: Member, settings: Settings) {
    this.doc = new jsPDF();
    this.currentY = this.margin;

    this.addHeader(
      `Member Ledger - ${member.name}`,
      "Hilal Connect Organization"
    );

    // Member details
    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Member Information:", this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(10);
    const memberInfo = [
      `Name: ${member.name}`,
      `Father Name: ${member.fatherName}`,
      `Email: ${member.email}`,
      `Phone: ${member.phone}`,
      `Join Date: ${formatDate(member.joinDate)}`,
      `Total Budget: PKR ${member.totalBudget.toLocaleString()}`,
    ];

    memberInfo.forEach((info) => {
      this.doc.text(info, this.margin, this.currentY);
      this.currentY += 6;
    });

    this.currentY += 10;

    // Contributions table
    if (member.monthlyContributions.length > 0) {
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Monthly Contributions:", this.margin, this.currentY);
      this.currentY += 8;

      const contributionHeaders = ["Date", "Amount (PKR)", "Status"];
      const contributionData = member.monthlyContributions.map((contrib) => [
        formatDate(contrib.month),
        contrib.amount.toLocaleString(),
        contrib.paid ? "Paid" : "Pending",
      ]);

      this.addTable(contributionHeaders, contributionData);
    }

    // Loans table
    if (member.loans.length > 0) {
      this.checkPageBreak(30);
      this.doc.setFontSize(11);
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Loan History:", this.margin, this.currentY);
      this.currentY += 8;

      const loanHeaders = ["Date", "Amount Payable", "Remaining", "Status"];
      const loanData = member.loans.map((loan) => {
        const effectiveInterest = settings.applyLoanInterest
          ? settings.loanInterestRate
          : 0;
        const amountWithInterest = loan.amount * (1 + effectiveInterest / 100);
        return [
          formatDate(loan.date),
          `PKR ${amountWithInterest.toLocaleString()}`,
          `PKR ${loan.remainingAmount.toLocaleString()}`,
          loan.status,
        ];
      });

      this.addTable(loanHeaders, loanData);
    }

    return this.doc;
  }

  generateLoanRegister(members: Member[], settings: Settings) {
    this.doc = new jsPDF();
    this.currentY = this.margin;

    this.addHeader("Loan Register", "Hilal Connect Organization");

    const loanHeaders = [
      "Member Name",
      "Loan Date",
      "Amount Payable",
      "Remaining",
      "Status",
    ];
    const loanData: string[][] = [];

    members.forEach((member) => {
      member.loans.forEach((loan) => {
        const effectiveInterest = settings.applyLoanInterest
          ? settings.loanInterestRate
          : 0;
        const amountWithInterest = loan.amount * (1 + effectiveInterest / 100);
        loanData.push([
          member.name,
          formatDate(loan.date),
          `PKR ${amountWithInterest.toLocaleString()}`,
          `PKR ${loan.remainingAmount.toLocaleString()}`,
          loan.status,
        ]);
      });
    });

    if (loanData.length > 0) {
      this.addTable(loanHeaders, loanData);
    } else {
      this.doc.setFontSize(12);
      this.doc.text("No loans found.", this.margin, this.currentY);
    }

    return this.doc;
  }

  generateContributionRegister(members: Member[]) {
    this.doc = new jsPDF();
    this.currentY = this.margin;

    this.addHeader("Contribution Register", "Hilal Connect Organization");

    const contributionHeaders = [
      "Member Name",
      "Date",
      "Amount (PKR)",
      "Present",
    ];
    const contributionData: string[][] = [];

    members.forEach((member) => {
      member.monthlyContributions.forEach((contrib) => {
        const attendanceRecord = member.attendance.find(
          (a) => a.date === contrib.month
        );
        contributionData.push([
          member.name,
          formatDate(contrib.month),
          contrib.amount.toLocaleString(),
          attendanceRecord?.present ? "Yes" : "No",
        ]);
      });
    });

    if (contributionData.length > 0) {
      this.addTable(contributionHeaders, contributionData);
    } else {
      this.doc.setFontSize(12);
      this.doc.text("No contributions found.", this.margin, this.currentY);
    }

    return this.doc;
  }

  generateFinancialSummary(data: ReportData) {
    this.doc = new jsPDF();
    this.currentY = this.margin;

    this.addHeader("Financial Summary Report", data.organizationName);

    this.doc.setFontSize(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("Summary Statistics:", this.margin, this.currentY);
    this.currentY += 10;

    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(11);
    const summaryData = [
      `Total Members: ${data.members.length}`,
      `Total Contributions: PKR ${data.totalContributions.toLocaleString()}`,
      `Total Loans Issued: PKR ${data.totalLoans.toLocaleString()}`,
      `Total Loans Recovered: PKR ${data.totalLoanRecovered.toLocaleString()}`,
      `Outstanding Loans: PKR ${(
        data.totalLoans - data.totalLoanRecovered
      ).toLocaleString()}`,
      `Reserve Fund: PKR ${data.reserveFund.toLocaleString()}`,
      `Net Position: PKR ${(
        data.totalContributions +
        data.totalLoanRecovered -
        data.totalLoans -
        data.reserveFund
      ).toLocaleString()}`,
    ];

    summaryData.forEach((item) => {
      this.doc.text(item, this.margin, this.currentY);
      this.currentY += 8;
    });

    return this.doc;
  }

  generateAttendanceReport(members: Member[]) {
    this.doc = new jsPDF();
    this.currentY = this.margin;

    this.addHeader("Attendance Report", "Hilal Connect Organization");

    const attendanceHeaders = ["Member Name", "Date", "Present"];
    const attendanceData: string[][] = [];

    members.forEach((member) => {
      member.attendance.forEach((attendance) => {
        attendanceData.push([
          member.name,
          formatDate(attendance.date),
          attendance.present ? "Yes" : "No",
        ]);
      });
    });

    if (attendanceData.length > 0) {
      this.addTable(attendanceHeaders, attendanceData);
    } else {
      this.doc.setFontSize(12);
      this.doc.text("No attendance records found.", this.margin, this.currentY);
    }

    return this.doc;
  }

  generateMemberDirectory(members: Member[]) {
    this.doc = new jsPDF();
    this.currentY = this.margin;

    this.addHeader("Member Directory", "Hilal Connect Organization");

    const directoryHeaders = [
      "Name",
      "Father Name",
      "Email",
      "Phone",
      "Join Date",
    ];
    const directoryData = members.map((member) => [
      member.name,
      member.fatherName,
      member.email,
      member.phone,
      formatDate(member.joinDate),
    ]);

    if (directoryData.length > 0) {
      this.addTable(directoryHeaders, directoryData);
    } else {
      this.doc.setFontSize(12);
      this.doc.text("No members found.", this.margin, this.currentY);
    }

    return this.doc;
  }

  downloadPDF(filename: string) {
    this.doc.save(filename);
  }
}

// Utility function to generate and download reports
export const generateReport = async (
  reportType:
    | "member-ledger"
    | "loan-register"
    | "contribution-register"
    | "financial-summary"
    | "attendance"
    | "member-directory",
  data: {
    member?: Member;
    members?: Member[];
    totalContributions?: number;
    totalLoans?: number;
    totalLoanRecovered?: number;
    reserveFund?: number;
    organizationName?: string;
  },
  settings?: Settings
) => {
  const reports = new PDFReports();

  let doc: jsPDF;
  let filename: string;

  switch (reportType) {
    case "member-ledger":
      doc = reports.generateMemberLedger(data.member, settings);
      filename = `Member_Ledger_${data.member.name.replace(/\s+/g, "_")}.pdf`;
      break;
    case "loan-register":
      doc = reports.generateLoanRegister(data.members, settings);
      filename = "Loan_Register.pdf";
      break;
    case "contribution-register":
      doc = reports.generateContributionRegister(data.members);
      filename = "Contribution_Register.pdf";
      break;
    case "financial-summary": {
      if (
        !data.members ||
        !data.totalContributions ||
        !data.totalLoans ||
        !data.totalLoanRecovered ||
        !data.reserveFund ||
        !data.organizationName
      ) {
        throw new Error(
          "Complete financial data required for financial summary"
        );
      }
      const summaryData: ReportData = {
        members: data.members,
        totalContributions: data.totalContributions,
        totalLoans: data.totalLoans,
        totalLoanRecovered: data.totalLoanRecovered,
        reserveFund: data.reserveFund,
        organizationName: data.organizationName,
        currentDate: new Date().toISOString(),
      };
      doc = reports.generateFinancialSummary(summaryData);
      filename = "Financial_Summary.pdf";
      break;
    }
    case "attendance":
      doc = reports.generateAttendanceReport(data.members);
      filename = "Attendance_Report.pdf";
      break;
    case "member-directory":
      doc = reports.generateMemberDirectory(data.members);
      filename = "Member_Directory.pdf";
      break;
    default:
      throw new Error("Invalid report type");
  }

  reports.downloadPDF(filename);
};
