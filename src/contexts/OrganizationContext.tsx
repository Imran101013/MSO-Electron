import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { ORGANIZATION_CONFIG, LoanStatus } from "@/config/organization";
import { useSettings } from "./SettingsContext";
import { useMembers, DbMember } from "@/hooks/useMembers";
import { useLoans, DbLoan, DbLoanInstallment } from "@/hooks/useLoans";
import { useContributions, DbContribution } from "@/hooks/useContributions";
import { useAttendance, DbAttendance } from "@/hooks/useAttendance";
import { useMeetings, DbMeeting, DbUpcomingMeeting } from "@/hooks/useMeetings";
import { useReserveTransactions } from "@/hooks/useReserveTransactions";
import { useProfitDistributions } from "@/hooks/useProfitDistributions";

export interface MonthlyContribution {
  month: string;
  amount: number;
  paid: boolean;
}

export interface Attendance {
  date: string;
  present: boolean;
}

export interface LoanInstallment {
  date: string;
  amount: number;
}

export interface Loan {
  id: number;
  dbId: string;
  amount: number;
  date: string;
  status: LoanStatus;
  remainingAmount: number;
  installments: LoanInstallment[];
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
  id: string;
  type: "donation" | "expense" | "profit_allocation";
  amount: number;
  date: string;
  donorName?: string;
  notes?: string;
}

export interface ProfitAllocation {
  memberId: string;
  memberName: string;
  amount: number;
  ratio: number;
}

export interface ProfitDistribution {
  id: string;
  date: string;
  totalProfit: number;
  reserveAllocation: number;
  memberAllocations: ProfitAllocation[];
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
  venue: string;
}

export interface Member {
  id: number;
  dbId: string;
  name: string;
  fatherName: string;
  dob: Date;
  email: string;
  phone: string;
  address: string;
  joinDate: Date;
  profilePicture?: string;
  password?: string;
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
  addReserveTransaction: (t: Omit<ReserveTransaction, "id">) => Promise<boolean>;
  addLoanIssue: (memberId: number, amount: number, date: string) => void;
  addLoanCollection: (
    memberId: number,
    loanId: number,
    amount: number,
    date: string
  ) => void;
  addPastLoan: (
    memberId: number,
    amount: number,
    date: string,
    status: LoanStatus,
    remainingAmount: number
  ) => void;
  totalDonations: number;
  totalExpenses: number;
  totalLoanCollected: number;
  totalLoanOutstanding: number;
  totalLoanRecovered: number;
  totalLoanInstallmentCollected: number; // new property for installments sum
  budgetTrend: { amount: number; percentage: number } | null;

  loansTrend: { amount: number; percentage: number } | null;
  reserveTrend: { amount: number; percentage: number } | null;
  profitDistributions: ProfitDistribution[];
  calculateBudgetRatios: () => ProfitAllocation[];
  distributeProfit: (totalProfit: number, date: string) => Promise<boolean>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

const initialMembers: Member[] = [
  {
    id: 1,
    dbId: "sample-1",
    name: "John Doe",
    fatherName: "Father Doe",
    dob: new Date("1990-01-01"),
    email: "john@example.com",
    phone: "03001234567",
    address: "123 Main St",
    joinDate: new Date("2023-01-01"),
    monthlyContributions: [
      { month: "2024-01", amount: 500, paid: true },
      { month: "2024-02", amount: 500, paid: false }
    ],
    attendance: [
      { date: "2024-01-01", present: true },
      { date: "2024-02-01", present: false }
    ],
    loans: [
      {
        id: 1,
        dbId: "sample-loan-1",
        amount: 5000,
        date: "2024-01-15",
        status: "Active",
        remainingAmount: 3000,
        installments: [
          { date: "2024-02-01", amount: 1000 },
          { date: "2024-03-01", amount: 1000 }
        ]
      }
    ],
    totalBudget: 10000
  },
  {
    id: 2,
    dbId: "sample-2",
    name: "Jane Smith",
    fatherName: "Father Smith",
    dob: new Date("1992-05-15"),
    email: "jane@example.com",
    phone: "03009876543",
    address: "456 Oak St",
    joinDate: new Date("2023-03-01"),
    monthlyContributions: [
      { month: "2024-01", amount: 500, paid: true },
      { month: "2024-02", amount: 500, paid: true }
    ],
    attendance: [
      { date: "2024-01-01", present: true },
      { date: "2024-02-01", present: true }
    ],
    loans: [],
    totalBudget: 15000
  }
];
const initialMeetings: Meeting[] = [
  {
    id: 1,
    date: "2024-01-15",
    agenda: "Monthly meeting and loan approvals",
    decisions: "Approved 3 new loans",
    contributions: [
      { memberId: 1, amount: 500, present: true },
      { memberId: 2, amount: 500, present: true }
    ],
    loanCollections: [
      { memberId: 1, loanId: 1, amount: 1000 }
    ],
    loanIssues: [],
    reserveFundDonations: []
  }
];
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
  const [profitDistributions, setProfitDistributions] = useState<
    ProfitDistribution[]
  >([]);

  // access runtime-editable settings
  const { settings } = useSettings();
  const effectiveInterestRate = settings.applyLoanInterest
    ? settings.loanInterestRate
    : 0;

  // Load data from Postgres via the Electron IPC bridge
  const { members: dbMembers, fetchMembers: refetchMembers } = useMembers();
  const { loans: dbLoans, installments: dbInstallments } = useLoans();
  const { contributions: dbContributions } = useContributions();
  const { attendance: dbAttendance } = useAttendance();
  const { meetings: dbMeetings, upcomingMeetings: dbUpcomingMeetings } = useMeetings();
  const { transactions: dbReserveTransactions, addTransaction: dbAddReserveTransaction } = useReserveTransactions();
  const { distributions: dbDistributions, allocations: dbAllocations, recordDistribution } = useProfitDistributions();

  // Transform database data to context format
  useEffect(() => {
    if (dbMembers.length > 0) {
      const transformedMembers: Member[] = dbMembers.map((dbMember: DbMember) => {
        // Get loans for this member
        const memberLoans = dbLoans
          .filter((loan: DbLoan) => loan.member_id === dbMember.id)
          .map((loan: DbLoan) => {
            const loanInstallments = dbInstallments
              .filter((inst: DbLoanInstallment) => inst.loan_id === loan.id)
              .map((inst: DbLoanInstallment) => ({
                date: inst.payment_date,
                amount: inst.amount,
              }));

            return {
              id: parseInt(loan.id),
              dbId: loan.id,
              amount: loan.amount,
              date: loan.loan_date,
              status: loan.status as LoanStatus,
              remainingAmount: loan.remaining_amount,
              installments: loanInstallments,
            };
          });

        // Get contributions for this member
        const memberContributions = dbContributions
          .filter((contrib: DbContribution) => contrib.member_id === dbMember.id)
          .map((contrib: DbContribution) => ({
            month: contrib.contribution_date,
            amount: contrib.amount,
            paid: true, // Assume paid if contribution exists
          }));

        // Get attendance for this member
        const memberAttendance = dbAttendance
          .filter((att: DbAttendance) => att.member_id === dbMember.id)
          .map((att: DbAttendance) => ({
            date: att.created_at.split('T')[0], // Use created_at date as attendance date
            present: att.present,
          }));

        return {
          id: parseInt(dbMember.id),
          dbId: dbMember.id,
          name: dbMember.name,
          fatherName: dbMember.father_name,
          dob: dbMember.dob ? new Date(dbMember.dob) : new Date(),
          email: dbMember.email || '',
          phone: dbMember.phone || '',
          address: dbMember.address || '',
          joinDate: new Date(dbMember.join_date),
          profilePicture: dbMember.profile_picture || undefined,
          monthlyContributions: memberContributions,
          attendance: memberAttendance,
          loans: memberLoans,
          totalBudget: dbMember.total_budget,
        };
      });

      setMembers(transformedMembers);
    } else {
      // Use sample data if no database data is available
      setMembers(initialMembers);
    }
  }, [dbMembers, dbLoans, dbInstallments, dbContributions, dbAttendance]);

  // Transform meetings data
  useEffect(() => {
    if (dbMeetings.length > 0) {
      const transformedMeetings: Meeting[] = dbMeetings.map((dbMeeting: DbMeeting) => ({
        id: parseInt(dbMeeting.id),
        date: dbMeeting.meeting_date,
        agenda: dbMeeting.agenda,
        decisions: dbMeeting.decisions || '',
        contributions: [], // TODO: Load meeting contributions
        loanCollections: [], // TODO: Load meeting loan collections
        loanIssues: [], // TODO: Load meeting loan issues
        reserveFundDonations: [], // TODO: Load reserve fund donations
      }));

      setMeetings(transformedMeetings);
    }
  }, [dbMeetings]);

  // Transform upcoming meetings data
  useEffect(() => {
    if (dbUpcomingMeetings.length > 0) {
      const transformedUpcomingMeetings: UpcomingMeeting[] = dbUpcomingMeetings.map((dbMeeting: DbUpcomingMeeting) => ({
        id: parseInt(dbMeeting.id),
        date: dbMeeting.meeting_date,
        time: dbMeeting.meeting_time || '',
        venue: dbMeeting.venue || '',
      }));

      setUpcomingMeetings(transformedUpcomingMeetings);
    }
  }, [dbUpcomingMeetings]);

  // Transform reserve transactions data
  useEffect(() => {
    const transformedTransactions: ReserveTransaction[] = dbReserveTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.transaction_type as "donation" | "expense" | "profit_allocation",
      amount: transaction.amount,
      date: transaction.transaction_date,
      donorName: transaction.donor_name || undefined,
      notes: transaction.notes || undefined,
    }));

    setReserveTransactions(transformedTransactions);
  }, [dbReserveTransactions]);

  // Transform profit distributions + their per-member allocations
  useEffect(() => {
    const transformed: ProfitDistribution[] = dbDistributions.map((dist) => ({
      id: dist.id,
      date: dist.distribution_date,
      totalProfit: dist.total_profit,
      reserveAllocation: dist.reserve_allocation,
      memberAllocations: dbAllocations
        .filter((a) => a.distribution_id === dist.id)
        .map((a) => {
          const member = dbMembers.find((m) => m.id === a.member_id);
          return {
            memberId: a.member_id,
            memberName: member?.name || "Unknown Member",
            amount: a.amount,
            ratio: a.ratio,
          };
        }),
    }));

    setProfitDistributions(transformed);
  }, [dbDistributions, dbAllocations, dbMembers]);

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

  // Calculate total loan collected from meetings (payments recorded in meetings)
  // this remains a record of payments logged via meeting entries

  // Total loan outstanding: compute from members' loan remainingAmount (this includes interest applied per loan)
  const totalLoanOutstanding = members.reduce((sum, member) => {
    const memberRemaining = member.loans.reduce(
      (loanSum, loan) => loanSum + loan.remainingAmount,
      0
    );
    return sum + memberRemaining;
  }, 0);

  // Calculate total recovered loans (amounts fully paid). Use principal+interest for each paid loan
  const totalLoanRecovered = members.reduce((sum, member) => {
    const paidWithInterest = member.loans
      .filter((loan) => loan.status === ORGANIZATION_CONFIG.LOAN_STATUS.PAID)
      .reduce(
        (loanSum, loan) =>
          loanSum + loan.amount * (1 + effectiveInterestRate / 100),
        0
      );
    return sum + paidWithInterest;
  }, 0);

  // Reserve transactions (donations/expenses) - computed before totals so budget includes them.
  // "profit_allocation" rows (the reserve's 10% cut from a profit distribution) count as
  // money coming into the reserve, same as a donation.
  const transactionDonations = reserveTransactions
    .filter((t) => t.type === "donation" || t.type === "profit_allocation")
    .reduce((s, t) => s + t.amount, 0);

  const transactionExpenses = reserveTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Calculate total loan amounts issued
  const totalLoanIssued = members.reduce((sum, member) => {
    return (
      sum + member.loans.reduce((loanSum, loan) => loanSum + loan.amount, 0)
    );
  }, 0);

  // Calculate total loan payments made
  const totalLoanPayments = members.reduce((sum, member) => {
    return (
      sum +
      member.loans.reduce((loanSum, loan) => {
        return (
          loanSum +
          loan.installments.reduce((instSum, inst) => instSum + inst.amount, 0)
        );
      }, 0)
    );
  }, 0);

  // Add new property totalLoanInstallmentCollected for the sum of installments paid
  const totalLoanInstallmentCollected = totalLoanPayments;

  // Calculate total contributions
  const contributions = members.reduce(
    (sum, member) => sum + member.totalBudget,
    0
  );

  // Calculate total budget as contributions minus loan issued plus loan payments plus reserve fund (donations minus expenses)
  const totalBudget =
    contributions -
    totalLoanIssued +
    totalLoanPayments +
    (transactionDonations - transactionExpenses);

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

  // Members trend (new members added this month vs last month)
  const currentMonthNewMembers = members.filter((m) => {
    const d = new Date(m.joinDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const lastMonthNewMembers = members.filter((m) => {
    const d = new Date(m.joinDate);
    return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
  }).length;

  const membersTrend =
    lastMonthNewMembers > 0
      ? {
          amount: currentMonthNewMembers - lastMonthNewMembers,
          percentage:
            ((currentMonthNewMembers - lastMonthNewMembers) /
              lastMonthNewMembers) *
            100,
        }
      : currentMonthNewMembers > 0
      ? { amount: currentMonthNewMembers, percentage: 100 }
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

  // Function to add a new loan issue
  const addLoanIssue = (memberId: number, amount: number, date: string) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    // Calculate amount with configured interest rate (per-loan, respect applyLoanInterest)
    const loanWithInterest = amount * (1 + effectiveInterestRate / 100);

    const newLoan: Loan = {
      id: member.loans.length + 1,
      dbId: `local-${member.dbId}-${Date.now()}`,
      amount,
      date,
      status: ORGANIZATION_CONFIG.LOAN_STATUS.ACTIVE,
      remainingAmount: loanWithInterest,
      installments: [],
    };

    const updatedMembers = members.map((m) =>
      m.id === memberId ? { ...m, loans: [...m.loans, newLoan] } : m
    );

    setMembers(updatedMembers);
  };

  // Function to add a loan collection (payment/installment)
  const addLoanCollection = (
    memberId: number,
    loanId: number,
    amount: number,
    date: string
  ) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    const loan = member.loans.find(
      (l) =>
        l.id === loanId && l.status === ORGANIZATION_CONFIG.LOAN_STATUS.ACTIVE
    );
    if (!loan) return;

    const newRemaining = Math.max(0, loan.remainingAmount - amount);
    const isFullyPaid = newRemaining === 0;

    const newInstallment: LoanInstallment = {
      date,
      amount,
    };

    const updatedMembers = members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            loans: m.loans.map((l) =>
              l.id === loanId &&
              l.status === ORGANIZATION_CONFIG.LOAN_STATUS.ACTIVE
                ? {
                    ...l,
                    remainingAmount: newRemaining,
                    installments: [...l.installments, newInstallment],
                    status: isFullyPaid
                      ? ORGANIZATION_CONFIG.LOAN_STATUS.PAID
                      : ORGANIZATION_CONFIG.LOAN_STATUS.ACTIVE,
                  }
                : l
            ),
          }
        : m
    );

    setMembers(updatedMembers);
  };

  // Function to add a past loan
  const addPastLoan = (
    memberId: number,
    amount: number,
    date: string,
    status: LoanStatus,
    remainingAmount: number
  ) => {
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    const newLoan: Loan = {
      id: member.loans.length + 1,
      dbId: `local-${member.dbId}-${Date.now()}`,
      amount,
      date,
      status,
      remainingAmount,
      installments: [],
    };

    const updatedMembers = members.map((m) =>
      m.id === memberId ? { ...m, loans: [...m.loans, newLoan] } : m
    );

    setMembers(updatedMembers);
  };

  // Function to add a reserve transaction — persists to Postgres via useReserveTransactions;
  // the dbReserveTransactions -> reserveTransactions transform effect above picks up the result.
  const addReserveTransaction = async (t: Omit<ReserveTransaction, "id">): Promise<boolean> => {
    const result = await dbAddReserveTransaction({
      transaction_type: t.type,
      amount: t.amount,
      donor_name: t.donorName,
      notes: t.notes,
      transaction_date: t.date,
    });
    return result !== null;
  };

  // Function to calculate budget ratios from total contributions across all time,
  // computed directly against the DB-backed member/contribution rows (real UUID ids).
  const calculateBudgetRatios = (): ProfitAllocation[] => {
    if (dbMembers.length === 0) return [];

    const memberTotals: Record<string, { memberId: string; memberName: string; total: number }> = {};

    dbContributions.forEach((contrib: DbContribution) => {
      const member = dbMembers.find((m: DbMember) => m.id === contrib.member_id);
      if (!member) return;
      if (!memberTotals[contrib.member_id]) {
        memberTotals[contrib.member_id] = {
          memberId: contrib.member_id,
          memberName: member.name,
          total: 0,
        };
      }
      memberTotals[contrib.member_id].total += contrib.amount;
    });

    const grandTotal = Object.values(memberTotals).reduce((s, m) => s + m.total, 0);
    if (grandTotal === 0) return [];

    return Object.values(memberTotals).map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      amount: m.total,
      ratio: m.total / grandTotal,
    }));
  };

  // Function to distribute profit: persists the distribution header, per-member allocations,
  // the reserve's cut (as a reserve_transactions row), and each member's budget bump.
  const distributeProfit = async (totalProfit: number, date: string): Promise<boolean> => {
    const budgetRatios = calculateBudgetRatios();
    if (budgetRatios.length === 0) return false;

    // Calculate reserve allocation (10%)
    const reserveAllocation = totalProfit * 0.1;

    // Calculate member allocations (90% distributed by budget ratio)
    const distributableAmount = totalProfit * 0.9;
    const memberAllocations = budgetRatios.map((ratio) => ({
      memberId: ratio.memberId,
      amount: Math.round(distributableAmount * ratio.ratio * 100) / 100, // Round to 2 decimal places
      ratio: ratio.ratio,
    }));

    const result = await recordDistribution(totalProfit, reserveAllocation, date, memberAllocations);
    if (!result) return false;

    // Refresh member budgets (recordDistribution updated total_budget in the DB)
    await refetchMembers();
    return true;
  };

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
        addReserveTransaction,
        addLoanIssue,
        addLoanCollection,
        addPastLoan,
        totalDonations: transactionDonations,
        totalExpenses: transactionExpenses,
        totalLoanCollected,
        totalLoanOutstanding,
        totalLoanRecovered,
        budgetTrend,
        loansTrend,
        reserveTrend,
        totalLoanInstallmentCollected,
        profitDistributions,
        calculateBudgetRatios,
        distributeProfit,
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
