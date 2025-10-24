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
  totalBudget: number;
  totalMembers: number;
  activeLoans: number;
  reserveFund: number;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const initialMembers: Member[] = [];

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);

  // Calculate total budget from all members
  const totalBudget = members.reduce((sum, member) => sum + member.totalBudget, 0);
  
  // Calculate total members
  const totalMembers = members.length;
  
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
        totalBudget, 
        totalMembers,
        activeLoans,
        reserveFund
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
