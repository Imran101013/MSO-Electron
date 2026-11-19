import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from "react";
import { LoanStatus } from "@/config/organization";
import { useMembers, DbMember } from "@/hooks/useMembers";
import { useLoans, DbLoan, DbLoanInstallment } from "@/hooks/useLoans";
import { useContributions, DbContribution } from "@/hooks/useContributions";
import { useAttendance, DbAttendance } from "@/hooks/useAttendance";
import { useMeetings, DbMeeting } from "@/hooks/useMeetings";
import { useReserveTransactions } from "@/hooks/useReserveTransactions";
import { useProfitDistributions } from "@/hooks/useProfitDistributions";
import { useBankProfits } from "@/hooks/useBankProfits";
import { fetchBooksConfig, type OpeningProfit } from "@/lib/books";
import type { YearEndPlan } from "@/utils/yearEndProfit";

export interface MonthlyContribution {
  id?: string;
  month: string;
  amount: number;
  paid: boolean;
  meetingId?: string | null;
  /** The savings balance brought forward from the paper registers, not a contribution. */
  isOpening?: boolean;
  createdAt?: string;
}

export interface Attendance {
  date: string;
  present: boolean;
  /** Not at the meeting but excused (present is false): not an absence. */
  onLeave?: boolean;
  meetingId?: string;
}

export interface LoanInstallment {
  id?: string;
  date: string;
  amount: number;
}

export interface LoanPenalty {
  month: number;
  chargeDate: string;
  amount: number;
}

export interface Loan {
  id: number;
  dbId: string;
  amount: number;
  date: string;
  status: LoanStatus;
  /** Includes late penalties charged. */
  remainingAmount: number;
  installments: LoanInstallment[];
  // Terms agreed for the loan and recorded when it was issued
  interestRate: number;
  totalPayable: number;
  termMonths: number;
  penaltyPerMonth: number;
  /** The day the committee marked the loan defaulted (null if it hasn't). */
  defaultedOn?: string | null;
  /** The bank's charge on the cheque withdrawal, repaid by the member with the loan. */
  bankCharge?: number;
  /** Late penalties charged after the loan's due date, oldest first. */
  penalties: LoanPenalty[];
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
  /** "opening": the balance brought forward from the paper registers at the cut-over date. */
  type: "donation" | "expense" | "profit_allocation" | "opening";
  amount: number;
  date: string;
  donorName?: string;
  notes?: string;
}

export interface ProfitAllocation {
  memberId: string;
  memberName: string;
  /** The dividend credited to the member's savings. */
  amount: number;
  ratio: number;
  /** Year-end distributions: the share before the absence penalty, the absences it was charged
   *  for, the penalty taken, and the savings on 31 December the share was based on. */
  grossAmount?: number;
  absences?: number;
  absencePenalty?: number;
  savingsBasis?: number;
}

export interface ProfitDistribution {
  id: string;
  date: string;
  /** The year's total profit (year-end distributions: bank profit + loan interest + late penalties collected). */
  totalProfit: number;
  /** The committee's amount for the reserve fund; absence penalties go to it on top. */
  reserveAllocation: number;
  memberAllocations: ProfitAllocation[];
  createdAt?: string;
  /** Set on year-end distributions; missing on earlier bank-profit-only ones. */
  profitYear?: number;
  bankProfit?: number;
  loanInterest?: number;
  loanPenalties?: number;
  absencePenalties?: number;
  absenceFine?: number;
  /** The bank profit came from the year's recorded bank profit entries (counted when the bank
   * credited it), not typed in at the AGM (counted on the AGM date). */
  bankProfitRecorded?: boolean;
}

/** The bank's profit on the account, as recorded with a meeting (hooks/useBankProfits.ts). */
export interface BankProfit {
  id: string;
  amount: number;
  /** yyyy-MM-dd the bank credited it. */
  creditedOn: string;
  /** The year it is shared out for, at the following July AGM. */
  profitYear: number;
  meetingId: string | null;
  meetingDate: string | null;
  /** The paper registers' bank profit for the year not yet shared at the cut-over. */
  isOpening: boolean;
}

export interface Meeting {
  id: number;
  dbId: string;
  date: string;
  agenda: string;
  decisions: string;
  contributions: MeetingContribution[];
  loanCollections: MeetingLoanCollection[];
  loanIssues: MeetingLoanIssue[];
  reserveFundDonations: MeetingReserveFund[];
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
  meetings: Meeting[];
  reserveFund: number;
  reserveTransactions: ReserveTransaction[];
  /** `bankCharge`: for an expense above the limit in Settings, the bank's charge on the cheque (paid by the reserve). */
  addReserveTransaction: (t: Omit<ReserveTransaction, "id"> & { bankCharge?: number }) => Promise<boolean>;
  totalDonations: number;
  totalExpenses: number;
  profitDistributions: ProfitDistribution[];
  bankProfits: BankProfit[];
  /** The year's profit not yet shared at the cut-over, from the paper registers (null if none). */
  openingProfit: OpeningProfit | null;
  /** Records a year-end distribution worked out by utils/yearEndProfit.ts. */
  distributeYearEnd: (plan: YearEndPlan, date: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

const initialMembers: Member[] = [];
const initialMeetings: Meeting[] = [];

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);
  const [reserveTransactions, setReserveTransactions] = useState<
    ReserveTransaction[]
  >([]);
  const [profitDistributions, setProfitDistributions] = useState<
    ProfitDistribution[]
  >([]);

  // Load data from Postgres via the Electron IPC bridge
  const { members: dbMembers, fetchMembers: refetchMembers } = useMembers();
  const { loans: dbLoans, installments: dbInstallments, penalties: dbPenalties, fetchLoans, fetchInstallments } = useLoans();
  const { contributions: dbContributions, fetchContributions: refetchContributions } = useContributions();
  const { attendance: dbAttendance, fetchAttendance } = useAttendance();
  const { meetings: dbMeetings, fetchMeetings } = useMeetings();
  const { transactions: dbReserveTransactions, addTransaction: dbAddReserveTransaction, fetchTransactions } = useReserveTransactions();
  const { distributions: dbDistributions, allocations: dbAllocations, recordYearEnd, fetchDistributions } = useProfitDistributions();
  const { bankProfits: dbBankProfits, fetchBankProfits } = useBankProfits();
  const [openingProfit, setOpeningProfit] = useState<OpeningProfit | null>(null);
  const fetchOpeningProfit = () => fetchBooksConfig().then((c) => setOpeningProfit(c.openingProfit)).catch(() => {});
  useEffect(() => { fetchOpeningProfit(); }, []);
  const bankProfits = useMemo<BankProfit[]>(
    () => dbBankProfits.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      creditedOn: String(b.credited_on).slice(0, 10),
      profitYear: Number(b.profit_year),
      meetingId: b.meeting_id,
      meetingDate: b.meeting_date ? String(b.meeting_date).slice(0, 10) : null,
      isOpening: !!b.is_opening,
    })),
    [dbBankProfits],
  );

  // Resolves pending refreshData() calls. The reloaded rows reach state on one render and are
  // turned into members/meetings/etc. by the effects below, which set state again — so waiting
  // for a render after the rows land (refreshSettled) means the derived state is current too.
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [refreshSettled, setRefreshSettled] = useState(0);
  const refreshWaiters = useRef<Array<() => void>>([]);
  useEffect(() => {
    if (refreshRequest) setRefreshSettled(refreshRequest);
  }, [refreshRequest]);
  useEffect(() => {
    refreshWaiters.current.splice(0).forEach((resolve) => resolve());
  }, [refreshSettled]);

  // These hook instances load once when the provider mounts, while other pages write through
  // their own instances — reports call this first so they are built from current records.
  const refreshData = async () => {
    await Promise.all([
      refetchMembers(),
      fetchLoans(),
      fetchInstallments(),
      refetchContributions(),
      fetchAttendance(),
      fetchMeetings(),
      fetchTransactions(),
      fetchDistributions(),
      fetchBankProfits(),
      fetchOpeningProfit(),
    ]);
    await new Promise<void>((resolve) => {
      refreshWaiters.current.push(resolve);
      setRefreshRequest((n) => n + 1);
    });
  };

  // Transform database data to context format
  useEffect(() => {
    if (dbMembers.length > 0) {
      const transformedMembers: Member[] = dbMembers.map((dbMember: DbMember, idx: number) => {
        // Get loans for this member
        const memberLoans = dbLoans
          .filter((loan: DbLoan) => loan.member_id === dbMember.id)
          .map((loan: DbLoan) => {
            const loanInstallments = dbInstallments
              .filter((inst: DbLoanInstallment) => inst.loan_id === loan.id)
              .map((inst: DbLoanInstallment) => ({
                id: inst.id,
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
              interestRate: Number(loan.interest_rate) || 0,
              totalPayable: Number(loan.total_payable) || loan.amount,
              termMonths: loan.term_months || 1,
              penaltyPerMonth: Number(loan.penalty_per_month) || 0,
              defaultedOn: loan.defaulted_on ?? null,
              bankCharge: Number(loan.bank_charge) || 0,
              penalties: dbPenalties
                .filter((p) => p.loan_id === loan.id)
                .map((p) => ({ month: p.penalty_month, chargeDate: p.charge_date, amount: Number(p.amount) })),
            };
          });

        // Get contributions for this member
        const memberContributions = dbContributions
          .filter((contrib: DbContribution) => contrib.member_id === dbMember.id)
          .map((contrib: DbContribution) => ({
            id: contrib.id,
            month: contrib.contribution_date,
            amount: contrib.amount,
            paid: true, // Assume paid if contribution exists
            meetingId: contrib.meeting_id,
            isOpening: !!contrib.is_opening,
            createdAt: contrib.created_at,
          }));

        // Get attendance for this member
        const memberAttendance = dbAttendance
          .filter((att: DbAttendance) => att.member_id === dbMember.id)
          .map((att: DbAttendance) => ({
            date: att.created_at.substring(0, 10),
            present: att.present,
            onLeave: !!att.on_leave,
            meetingId: att.meeting_id,
          }));

        return {
          id: idx + 1,
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
    }
  }, [dbMembers, dbLoans, dbInstallments, dbPenalties, dbContributions, dbAttendance]);

  // Transform meetings data
  useEffect(() => {
    if (dbMeetings.length > 0) {
      const transformedMeetings: Meeting[] = dbMeetings.map((dbMeeting: DbMeeting) => ({
        id: parseInt(dbMeeting.id),
        dbId: dbMeeting.id,
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

  // Transform reserve transactions data
  useEffect(() => {
    const transformedTransactions: ReserveTransaction[] = dbReserveTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.transaction_type as "donation" | "expense" | "profit_allocation" | "opening",
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
      createdAt: dist.created_at,
      profitYear: dist.profit_year ?? undefined,
      bankProfit: dist.bank_profit ?? undefined,
      loanInterest: dist.loan_interest ?? 0,
      loanPenalties: dist.loan_penalties ?? 0,
      absencePenalties: dist.absence_penalties ?? 0,
      absenceFine: dist.absence_fine ?? undefined,
      bankProfitRecorded: !!dist.bank_profit_recorded,
      memberAllocations: dbAllocations
        .filter((a) => a.distribution_id === dist.id)
        .map((a) => {
          const member = dbMembers.find((m) => m.id === a.member_id);
          return {
            memberId: a.member_id,
            memberName: member?.name || "Unknown Member",
            amount: a.amount,
            ratio: a.ratio,
            grossAmount: a.gross_amount ?? undefined,
            absences: a.absences ?? 0,
            absencePenalty: a.absence_penalty ?? 0,
            savingsBasis: a.savings_basis ?? undefined,
          };
        }),
    }));

    setProfitDistributions(transformed);
  }, [dbDistributions, dbAllocations, dbMembers]);

  // Reserve transactions (donations/expenses).
  // "profit_allocation" rows (the reserve's cut from a profit distribution) and the "opening"
  // balance brought forward from the paper registers count as money coming into the reserve,
  // same as a donation.
  const transactionDonations = reserveTransactions
    .filter((t) => t.type !== "expense")
    .reduce((s, t) => s + t.amount, 0);

  const transactionExpenses = reserveTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  // Reserve fund is the net of reserve transactions only (independent of meetings)
  const reserveFund = transactionDonations - transactionExpenses;

  // Function to add a reserve transaction — persists to Postgres via useReserveTransactions;
  // the dbReserveTransactions -> reserveTransactions transform effect above picks up the result.
  const addReserveTransaction = async (t: Omit<ReserveTransaction, "id"> & { bankCharge?: number }): Promise<boolean> => {
    const result = await dbAddReserveTransaction({
      transaction_type: t.type,
      amount: t.amount,
      donor_name: t.donorName,
      notes: t.notes,
      transaction_date: t.date,
      bank_charge: t.bankCharge,
    });
    return result !== null;
  };

  // Records a year-end distribution (worked out on the Profit Distribution page from the books),
  // then reloads members and the reserve fund so they include it.
  const distributeYearEnd = async (plan: YearEndPlan, date: string): Promise<boolean> => {
    const result = await recordYearEnd(plan, date);
    if (!result) return false;
    await refetchMembers();
    await fetchTransactions();
    return true;
  };

  return (
    <OrganizationContext.Provider
      value={{
        members,
        meetings,
        reserveFund,
        reserveTransactions,
        addReserveTransaction,
        totalDonations: transactionDonations,
        totalExpenses: transactionExpenses,
        profitDistributions,
        bankProfits,
        openingProfit,
        distributeYearEnd,
        refreshData,
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
