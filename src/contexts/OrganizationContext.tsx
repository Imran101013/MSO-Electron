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

const initialMembers: Member[] = [
  { 
    id: 1, 
    name: "Muhammad Ahmed", 
    fatherName: "Ahmed Ali", 
    dob: "1990-05-15", 
    email: "ahmed@email.com", 
    phone: "+92 300 1234567", 
    address: "Street 12, Block A, Lahore", 
    joinDate: "Jan 2024",
    monthlyContributions: [
      { month: "January 2024", amount: 5000, paid: true },
      { month: "February 2024", amount: 5000, paid: true },
      { month: "March 2024", amount: 5000, paid: false },
    ],
    attendance: [
      { date: "2024-01-15", present: true },
      { date: "2024-02-15", present: true },
      { date: "2024-03-15", present: false },
    ],
    loans: [
      { id: 1, amount: 50000, date: "2024-02-01", status: "Active", remainingAmount: 30000 },
    ],
    totalBudget: 10000
  },
  { 
    id: 2, 
    name: "Ali Hassan", 
    fatherName: "Hassan Mahmood", 
    dob: "1988-08-22", 
    email: "ali@email.com", 
    phone: "+92 301 2345678", 
    address: "House 45, Garden Town, Lahore", 
    joinDate: "Feb 2024",
    monthlyContributions: [
      { month: "February 2024", amount: 5000, paid: true },
      { month: "March 2024", amount: 5000, paid: true },
    ],
    attendance: [
      { date: "2024-02-15", present: true },
      { date: "2024-03-15", present: true },
    ],
    loans: [],
    totalBudget: 10000
  },
  { 
    id: 3, 
    name: "Usman Khan", 
    fatherName: "Khan Sahib", 
    dob: "1992-03-10", 
    email: "usman@email.com", 
    phone: "+92 302 3456789", 
    address: "Flat 3, Model Town, Karachi", 
    joinDate: "Mar 2024",
    monthlyContributions: [
      { month: "March 2024", amount: 5000, paid: true },
    ],
    attendance: [
      { date: "2024-03-15", present: true },
    ],
    loans: [
      { id: 2, amount: 30000, date: "2024-03-10", status: "Paid", remainingAmount: 0 },
    ],
    totalBudget: 5000
  },
  { 
    id: 4, 
    name: "Imran Malik", 
    fatherName: "Malik Abbas", 
    dob: "1985-12-01", 
    email: "imran@email.com", 
    phone: "+92 303 4567890", 
    address: "Plot 78, DHA Phase 5, Islamabad", 
    joinDate: "Jan 2024",
    monthlyContributions: [
      { month: "January 2024", amount: 5000, paid: true },
      { month: "February 2024", amount: 5000, paid: true },
      { month: "March 2024", amount: 5000, paid: true },
    ],
    attendance: [
      { date: "2024-01-15", present: true },
      { date: "2024-02-15", present: true },
      { date: "2024-03-15", present: true },
    ],
    loans: [],
    totalBudget: 15000
  },
];

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
