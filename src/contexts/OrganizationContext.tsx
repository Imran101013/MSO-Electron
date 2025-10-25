import { createContext, useContext, useState, ReactNode } from 'react';

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
  status: "Active" | "Paid";
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

export interface Meeting {
  id: number;
  date: string;
  agenda: string;
  decisions: string;
  contributions: MeetingContribution[];
  loanCollections: MeetingLoanCollection[];
  loanIssues: MeetingLoanIssue[];
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
  totalBudget: number;
  totalMembers: number;
  activeLoans: number;
  reserveFund: number;
  totalLoanCollected: number;
  totalLoanOutstanding: number;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const initialMembers: Member[] = [];
const initialMeetings: Meeting[] = [];

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings);

  // Calculate total budget from all meetings contributions
  const totalBudget = meetings.reduce((sum, meeting) => {
    const meetingTotal = meeting.contributions.reduce((mSum, c) => mSum + c.amount, 0);
    return sum + meetingTotal;
  }, 0);
  
  // Calculate total members
  const totalMembers = members.length;
  
  // Calculate total loan collected from meetings
  const totalLoanCollected = meetings.reduce((sum, meeting) => {
    const meetingLoans = meeting.loanCollections.reduce((mSum, l) => mSum + l.amount, 0);
    return sum + meetingLoans;
  }, 0);

  // Calculate total loan issued from meetings
  const totalLoanIssued = meetings.reduce((sum, meeting) => {
    const meetingLoans = meeting.loanIssues.reduce((mSum, l) => mSum + l.amount, 0);
    return sum + meetingLoans;
  }, 0);

  // Total loan outstanding = issued - collected
  const totalLoanOutstanding = totalLoanIssued - totalLoanCollected;
  
  // Calculate active loans total
  const activeLoans = members.reduce((sum, member) => {
    const activeLoanAmount = member.loans
      .filter(loan => loan.status === "Active")
      .reduce((loanSum, loan) => loanSum + loan.remainingAmount, 0);
    return sum + activeLoanAmount;
  }, 0);
  
  // Reserve fund (20% of total budget for now)
  const reserveFund = Math.floor(totalBudget * 0.2);

  return (
    <OrganizationContext.Provider 
      value={{ 
        members, 
        setMembers,
        meetings,
        setMeetings,
        totalBudget, 
        totalMembers,
        activeLoans,
        reserveFund,
        totalLoanCollected,
        totalLoanOutstanding
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
