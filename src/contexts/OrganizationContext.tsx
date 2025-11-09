import { createContext, useContext, useState, ReactNode } from "react";
import { ORGANIZATION_CONFIG, LoanStatus } from "@/config/organization";

export interface MonthlyContribution {
  month: string;
  amount: number;
  paid: boolean;
}

export interface Attendance {
  date: string;
  present: boolean;
}

export interface Loan {
  id: number;
  amount: number;
  date: string;
  status: LoanStatus;
  remainingAmount: number;
}

export interface MeetingContribution {
  memberId: number;
  amount: number;
  present: boolean;
}

export interface MeetingLoanCollection {
  memberId: number;
  loanId: number;
  amount: number;
}

export interface MeetingLoanIssue {
  memberId: number;
  amount: number;
  loanId: number;
}

export interface MeetingReserveFund {
  amount: number;
  donorName?: string;
  notes?: string;
}

export interface ReserveTransaction {
  id: number;
  type: "donation" | "expense";
  amount: number;
  date: string;
  donorName?: string;
  notes?: string;
}

export interface Meeting {
  id: number;
  date: string;
  agenda: string;
  decisions: string;
  contributions: MeetingContribution[];
  loanCollections: MeetingLoanCollection[];
  loanIssues: MeetingLoanIssue[];
  reserveFundDonations: MeetingReserveFund[];
}

export interface UpcomingMeeting {
  id: number;
  date: string;
  time: string;
  agenda: string;
}

export interface Member {
  id: number;
  name: string;
  fatherName: string;
  dob: string;
  email: string;
  phone: string;
  address: string;
  joinDate: string;
  profilePicture?: string;
  monthlyContributions: MonthlyContribution[];
  attendance: Attendance[];
  loans: Loan[];
  totalBudget: number;
}

interface OrganizationContextType {
  members: Member[];
  setMembers: (members: Member[]) => void;
  meetings: Meeting[];
  setMeetings: (meetings: Meeting[]) => void;
  upcomingMeetings: UpcomingMeeting[];
  setUpcomingMeetings: (meetings: UpcomingMeeting[]) => void;
  totalBudget: number;
  totalMembers: number;
  activeLoans: number;
  reserveFund: number;
  reserveTransactions: ReserveTransaction[];
  addReserveTransaction: (t: Omit<ReserveTransaction, "id">) => void;
  totalDonations: number;
  totalExpenses: number;
  totalLoanCollected: number;
  totalLoanOutstanding: number;
  budgetTrend: { amount: number; percentage: number } | null;
  membersTrend: { amount: number; percentage: number } | null;
  loansTrend: { amount: number; percentage: number } | null;
  reserveTrend: { amount: number; percentage: number } | null;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

const initialMembers: Member[] = [];
const initialMeetings: Meeting[] = [];
const initialUpcomingMeetings: UpcomingMeeting[] = [];

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [upcomingMeetings, setUpcomingMeetings] = useState<UpcomingMeeting[]>(
    initialUpcomingMeetings
  );
  const [reserveTransactions, setReserveTransactions] = useState<
    ReserveTransaction[]
  >([]);

  // Calculate total members
  const totalMembers = members.length;

  // Calculate total loan collected from meetings
  const totalLoanCollected = meetings.reduce((sum, meeting) => {
    const meetingLoans = meeting.loanCollections.reduce(
      (mSum, l) => mSum + l.amount,
      0
    );
    return sum + meetingLoans;
  }, 0);

  // Calculate total loan issued from meetings
  const totalLoanIssued = meetings.reduce((sum, meeting) => {
    const meetingLoans = meeting.loanIssues.reduce(
      (mSum, l) => mSum + l.amount,
      0
    );
    return sum + meetingLoans;
  }, 0);

  // Total loan outstanding = issued - collected
  const totalLoanOutstanding = totalLoanIssued - totalLoanCollected;

  // Reserve transactions (donations/expenses) - computed before totals so budget includes them
  const transactionDonations = reserveTransactions
    .filter((t) => t.type === "donation")
    .reduce((s, t) => s + t.amount, 0);

  const transactionExpenses = reserveTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Calculate total budget from:
  // 1. Meeting contributions
  // 2. Members' past contributions
  // 3. Loan collections (installments paid)
  // 4. Subtract outstanding loans
  const totalBudget =
    meetings.reduce((sum, meeting) => {
      // Add regular contributions
      const meetingContributions = meeting.contributions.reduce(
        (mSum, c) => mSum + c.amount,
        0
      );
      // Add loan installments paid
      const meetingLoanCollections = meeting.loanCollections.reduce(
        (mSum, l) => mSum + l.amount,
        0
      );
      return sum + meetingContributions + meetingLoanCollections;
    }, 0) +
    members.reduce((sum, member) => sum + member.totalBudget, 0) -
    totalLoanOutstanding +
    transactionDonations -
    transactionExpenses; // Include reserve transactions (donations add, expenses subtract)

  // Calculate active loans total
  const activeLoans = members.reduce((sum, member) => {
    const activeLoanAmount = member.loans
      .filter((loan) => loan.status === ORGANIZATION_CONFIG.LOAN_STATUS.ACTIVE)
      .reduce((loanSum, loan) => loanSum + loan.remainingAmount, 0);
    return sum + activeLoanAmount;
  }, 0);

  // Reserve fund is the net of reserve transactions only (independent of meetings)
  const reserveFund = transactionDonations - transactionExpenses;

  // Calculate month-over-month trends
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentMonthMeetings = meetings.filter((m) => {
    const meetingDate = new Date(m.date);
    return (
      meetingDate.getMonth() === currentMonth &&
      meetingDate.getFullYear() === currentYear
    );
  });

  const lastMonthMeetings = meetings.filter((m) => {
    const meetingDate = new Date(m.date);
    return (
      meetingDate.getMonth() === lastMonth &&
      meetingDate.getFullYear() === lastMonthYear
    );
  });

  // Budget trend
  const currentMonthBudget = currentMonthMeetings.reduce((sum, meeting) => {
    return sum + meeting.contributions.reduce((cSum, c) => cSum + c.amount, 0);
  }, 0);

  const lastMonthBudget = lastMonthMeetings.reduce((sum, meeting) => {
    return sum + meeting.contributions.reduce((cSum, c) => cSum + c.amount, 0);
  }, 0);

  const budgetTrend =
    lastMonthBudget > 0
      ? {
          amount: currentMonthBudget - lastMonthBudget,
          percentage:
            ((currentMonthBudget - lastMonthBudget) / lastMonthBudget) * 100,
        }
      : currentMonthBudget > 0
      ? { amount: currentMonthBudget, percentage: 100 }
      : null;

  // Members trend (contributors this month vs last month)
  const currentMonthContributors = new Set(
    currentMonthMeetings.flatMap((m) => m.contributions.map((c) => c.memberId))
  ).size;

  const lastMonthContributors = new Set(
    lastMonthMeetings.flatMap((m) => m.contributions.map((c) => c.memberId))
  ).size;

  const membersTrend =
    lastMonthContributors > 0
      ? {
          amount: currentMonthContributors - lastMonthContributors,
          percentage:
            ((currentMonthContributors - lastMonthContributors) /
              lastMonthContributors) *
            100,
        }
      : currentMonthContributors > 0
      ? { amount: currentMonthContributors, percentage: 100 }
      : null;

  // Loans trend (outstanding loans change)
  const currentMonthLoanIssued = currentMonthMeetings.reduce((sum, meeting) => {
    return sum + meeting.loanIssues.reduce((lSum, l) => lSum + l.amount, 0);
  }, 0);

  const currentMonthLoanCollected = currentMonthMeetings.reduce(
    (sum, meeting) => {
      return (
        sum + meeting.loanCollections.reduce((lSum, l) => lSum + l.amount, 0)
      );
    },
    0
  );

  const lastMonthLoanIssued = lastMonthMeetings.reduce((sum, meeting) => {
    return sum + meeting.loanIssues.reduce((lSum, l) => lSum + l.amount, 0);
  }, 0);

  const lastMonthLoanCollected = lastMonthMeetings.reduce((sum, meeting) => {
    return (
      sum + meeting.loanCollections.reduce((lSum, l) => lSum + l.amount, 0)
    );
  }, 0);

  const currentMonthNetLoan =
    currentMonthLoanIssued - currentMonthLoanCollected;
  const lastMonthNetLoan = lastMonthLoanIssued - lastMonthLoanCollected;

  const loansTrend =
    lastMonthNetLoan !== 0
      ? {
          amount: currentMonthNetLoan - lastMonthNetLoan,
          percentage:
            ((currentMonthNetLoan - lastMonthNetLoan) /
              Math.abs(lastMonthNetLoan)) *
            100,
        }
      : currentMonthNetLoan !== 0
      ? { amount: currentMonthNetLoan, percentage: 100 }
      : null;

  // Reserve fund trend - compute last month's net reserve transactions (donations - expenses)
  const lastMonthReserveNet = reserveTransactions.reduce((sum, tx) => {
    const d = new Date(tx.date);
    if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) {
      return sum + (tx.type === "donation" ? tx.amount : -tx.amount);
    }
    return sum;
  }, 0);

  const reserveTrend =
    lastMonthReserveNet !== 0
      ? {
          amount: reserveFund - lastMonthReserveNet,
          percentage:
            ((reserveFund - lastMonthReserveNet) /
              Math.abs(lastMonthReserveNet)) *
            100,
        }
      : reserveFund !== 0
      ? { amount: reserveFund, percentage: 100 }
      : null;

  return (
    <OrganizationContext.Provider
      value={{
        members,
        setMembers,
        meetings,
        setMeetings,
        upcomingMeetings,
        setUpcomingMeetings,
        totalBudget,
        totalMembers,
        activeLoans,
        reserveFund,
        reserveTransactions,
        addReserveTransaction: (t: Omit<ReserveTransaction, "id">) => {
          const newTx: ReserveTransaction = {
            id: Date.now(),
            ...t,
          };
          setReserveTransactions((prev) => [newTx, ...prev]);
        },
        totalDonations: transactionDonations,
        totalExpenses: transactionExpenses,
        totalLoanCollected,
        totalLoanOutstanding,
        budgetTrend,
        membersTrend,
        loansTrend,
        reserveTrend,
      }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error(
      "useOrganization must be used within an OrganizationProvider"
    );
  }
  return context;
}
