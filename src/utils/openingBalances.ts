import { format } from "date-fns";
import type { RawCell, RawOpeningFile } from "@/lib/books";

/**
 * Checks a filled opening-balances template before anything is saved: every problem is listed by
 * sheet and row, and the totals are worked out so they can be compared with the register totals.
 * Only a file with no problems can be imported (electron/openingBalances.cjs does the loading).
 */

export interface OpeningMember {
  row: number;
  regNo: string;
  name: string;
  fatherName: string;
  phone: string | null;
  address: string | null;
  joinDate: string;
  savings: number;
  /** Meetings marked absent in the year whose profit is not yet shared (31 December cut-over). */
  absences: number;
}

export interface OpeningLoan {
  row: number;
  regNo: string;
  memberName: string;
  loanDate: string;
  amount: number;
  interest: number;
  repaid: number;
  penalties: number;
  defaulted: boolean;
  outstanding: number;
}

export interface OpeningIssue {
  sheet: "File" | "Members" | "Open loans" | "Reserve" | "Profit not yet shared";
  row?: number;
  message: string;
}

export interface OpeningCheck {
  cutoverDate: string;
  fileName: string | null;
  members: OpeningMember[];
  loans: OpeningLoan[];
  reserve: number;
  /** The year's profit not yet shared at the cut-over, or null when none was entered. */
  profit: { year: number; bankProfit: number; interest: number; penalties: number } | null;
  problems: OpeningIssue[];
  warnings: OpeningIssue[];
  totals: {
    members: number;
    savings: number;
    loans: number;
    lent: number;
    owed: number;
    reserve: number;
    /** Members' absences in the year whose profit is not yet shared. */
    absences: number;
    /** Savings + reserve + the profit not yet shared (bank profit, interest and penalties collected),
     * less what is still out on loan (amount lent less repaid). */
    bank: number;
  };
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

const text = (v: RawCell): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Blank is zero; "1,200", "Rs 1200" and "PKR 1,200.50" are read as numbers; anything else is NaN. */
const amount = (v: RawCell): number => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").replace(/^(pkr|rs\.?)\s*/i, "").trim();
  return s === "" ? 0 : /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
};

const pad = (n: number) => String(n).padStart(2, "0");
const validDay = (y: number, m: number, d: number) => {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 1900 && y <= 2100;
};

/** yyyy-MM-dd from a date cell, an Excel day number, or text like 15/03/2012; null if unreadable. */
const day = (v: RawCell): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (v < 1 || v > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m && validDay(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m && validDay(+m[3], +m[2], +m[1])) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return null;
};

const yes = (v: RawCell) => /^(y|yes|true|1)$/i.test(String(v ?? "").trim());

export function checkOpeningFile(file: RawOpeningFile, cutoverDate: string, dateFormat: string, currency: string): OpeningCheck {
  const problems: OpeningIssue[] = [];
  const warnings: OpeningIssue[] = [];
  const fmt = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return format(new Date(y, m - 1, d), dateFormat || "dd/MM/yyyy");
  };
  const money = (n: number) => `${currency} ${n.toLocaleString()}`;

  const fileCutover = text(file.meta?.cutoverDate ?? null);
  if (!fileCutover) {
    warnings.push({ sheet: "File", message: "This file wasn't made from the app's template, so the date it is for can't be confirmed. Make sure the balances are as at the cut-over date." });
  } else if (fileCutover.slice(0, 10) !== cutoverDate) {
    problems.push({
      sheet: "File",
      message: `This file is for balances as at ${fmt(fileCutover.slice(0, 10))}, but the cut-over date is ${fmt(cutoverDate)}. Download a new template for the current date.`,
    });
  }

  // Members
  const members: OpeningMember[] = [];
  const byReg = new Map<string, OpeningMember>();
  for (const r of file.members ?? []) {
    const regNo = text(r.regNo);
    const name = text(r.name);
    const at = { sheet: "Members" as const, row: r.row };
    if (!regNo) { problems.push({ ...at, message: "Reg. no. is missing." }); continue; }
    if (!name) { problems.push({ ...at, message: `Name is missing for reg. no. ${regNo}.` }); continue; }
    const key = regNo.toLowerCase();
    if (byReg.has(key)) { problems.push({ ...at, message: `Reg. no. ${regNo} is used twice (also row ${byReg.get(key)!.row}).` }); continue; }
    const fatherName = text(r.fatherName) ?? "";
    if (!fatherName) warnings.push({ ...at, message: `No father's name for ${name}.` });
    let joinDate = day(r.joinDate);
    if (r.joinDate !== null && r.joinDate !== undefined && r.joinDate !== "" && !joinDate) {
      problems.push({ ...at, message: `Join date "${r.joinDate}" for ${name} isn't a date. Use a date like 15/03/2012.` });
      continue;
    }
    if (!joinDate) {
      warnings.push({ ...at, message: `No join date for ${name}; the cut-over date will be used.` });
      joinDate = cutoverDate;
    } else if (joinDate > cutoverDate) {
      problems.push({ ...at, message: `${name} joined on ${fmt(joinDate)}, after the cut-over. Members who joined later are added on the Members page, not here.` });
      continue;
    }
    const savings = amount(r.savings);
    if (Number.isNaN(savings)) { problems.push({ ...at, message: `Savings balance "${r.savings}" for ${name} isn't a number.` }); continue; }
    if (savings < 0) { problems.push({ ...at, message: `Savings balance for ${name} is below zero.` }); continue; }
    const absences = amount(r.absences ?? null);
    if (Number.isNaN(absences) || absences < 0 || !Number.isInteger(absences)) {
      problems.push({ ...at, message: `Absences "${r.absences}" for ${name} isn't a whole number of 0 or more.` });
      continue;
    }
    const m: OpeningMember = { row: r.row, regNo, name, fatherName, phone: text(r.phone), address: text(r.address), joinDate, savings: r2(savings), absences };
    members.push(m);
    byReg.set(key, m);
  }
  if ((file.members ?? []).length === 0) problems.push({ sheet: "Members", message: "The Members sheet has no rows." });

  // Open loans
  const loans: OpeningLoan[] = [];
  const loanKeys = new Map<string, number>();
  for (const r of file.loans ?? []) {
    const at = { sheet: "Open loans" as const, row: r.row };
    const regNo = text(r.regNo);
    if (!regNo) { problems.push({ ...at, message: "Member reg. no. is missing." }); continue; }
    const member = byReg.get(regNo.toLowerCase());
    if (!member) { problems.push({ ...at, message: `Reg. no. ${regNo} isn't on the Members sheet.` }); continue; }
    const typedName = text(r.memberName);
    if (typedName && typedName.toLowerCase() !== member.name.toLowerCase()) {
      warnings.push({ ...at, message: `Name "${typedName}" doesn't match ${member.name} (reg. no. ${regNo}); the reg. no. is used.` });
    }
    const loanDate = day(r.loanDate);
    if (!loanDate) { problems.push({ ...at, message: r.loanDate ? `Loan date "${r.loanDate}" isn't a date.` : "Loan date is missing." }); continue; }
    if (loanDate > cutoverDate) { problems.push({ ...at, message: `Loan date ${fmt(loanDate)} is after the cut-over. Loans made later are issued on the Loans page.` }); continue; }
    if (loanDate < member.joinDate) warnings.push({ ...at, message: `Loan date ${fmt(loanDate)} is before ${member.name} joined (${fmt(member.joinDate)}).` });
    const lent = amount(r.amount);
    const interest = amount(r.interest);
    const repaid = amount(r.repaid);
    const penalties = amount(r.penalties);
    const bad = ([["Amount lent", lent, r.amount], ["Interest", interest, r.interest], ["Repaid so far", repaid, r.repaid], ["Penalties", penalties, r.penalties]] as const)
      .find(([, n]) => Number.isNaN(n) || n < 0);
    if (bad) { problems.push({ ...at, message: `${bad[0]} "${bad[2]}" isn't a number of 0 or more.` }); continue; }
    if (!(lent > 0)) { problems.push({ ...at, message: "Amount lent is missing." }); continue; }
    const outstanding = r2(lent + interest + penalties - repaid);
    if (outstanding <= EPS) {
      problems.push({ ...at, message: `This loan is repaid in full (${money(r2(lent + interest + penalties))} owed, ${money(repaid)} repaid). Only loans with money still owing go on this sheet.` });
      continue;
    }
    const key = `${member.regNo.toLowerCase()}|${loanDate}`;
    if (loanKeys.has(key)) { problems.push({ ...at, message: `${member.name} has two loans dated ${fmt(loanDate)} (also row ${loanKeys.get(key)}). Combine them into one row.` }); continue; }
    loanKeys.set(key, r.row);
    loans.push({
      row: r.row, regNo: member.regNo, memberName: member.name, loanDate,
      amount: r2(lent), interest: r2(interest), repaid: r2(repaid), penalties: r2(penalties),
      defaulted: yes(r.defaulted), outstanding,
    });
  }

  // Reserve
  let reserve = amount(file.reserve ?? null);
  if (Number.isNaN(reserve) || reserve < 0) {
    problems.push({ sheet: "Reserve", message: `Reserve fund balance "${file.reserve}" isn't a number of 0 or more.` });
    reserve = 0;
  }

  // The year's profit not yet shared: only with a 31 December cut-over, when that whole year is in
  // the registers and the savings above are the members' savings on 31 December.
  const profitYear = cutoverDate.slice(5) === "12-31" ? Number(cutoverDate.slice(0, 4)) : null;
  const p = file.profit ?? null;
  const pAmounts = ([["Bank profit", p?.bankProfit], ["Loan interest collected", p?.interest], ["Late penalties collected", p?.penalties]] as const)
    .map(([label, v]) => [label, amount(v ?? null), v] as const);
  const badProfit = pAmounts.find(([, n]) => Number.isNaN(n) || n < 0);
  if (badProfit) problems.push({ sheet: "Profit not yet shared", message: `${badProfit[0]} "${badProfit[2]}" isn't a number of 0 or more.` });
  const [bankProfit, interestIn, penaltiesIn] = pAmounts.map(([, n]) => (Number.isNaN(n) || n < 0 ? 0 : r2(n)));
  const absenceTotal = members.reduce((s, m) => s + m.absences, 0);
  const anyProfit = bankProfit > EPS || interestIn > EPS || penaltiesIn > EPS || absenceTotal > 0;
  if (anyProfit && !profitYear) {
    problems.push({ sheet: "Profit not yet shared", message: `A year's profit not yet shared can only be brought in with a 31 December cut-over date; the cut-over date is ${fmt(cutoverDate)}.` });
  }
  const profit = anyProfit && profitYear ? { year: profitYear, bankProfit, interest: interestIn, penalties: penaltiesIn } : null;
  if (profitYear && !anyProfit) {
    warnings.push({ sheet: "Profit not yet shared", message: `No ${profitYear} profit was entered. Leave it blank only if the ${profitYear} profit was already shared on paper; otherwise the July ${profitYear + 1} AGM will have nothing from ${profitYear} to share.` });
  }

  const savings = r2(members.reduce((s, m) => s + m.savings, 0));
  const lent = r2(loans.reduce((s, l) => s + l.amount, 0));
  const repaid = r2(loans.reduce((s, l) => s + l.repaid, 0));
  // The profit not yet shared is money already in the bank at the cut-over.
  const bank = r2(savings + reserve - (lent - repaid) + (profit ? profit.bankProfit + profit.interest + profit.penalties : 0));
  if (bank < -EPS) {
    warnings.push({ sheet: "File", message: `Worked out this way the bank balance would be below zero (${money(bank)}). Check the savings and loan figures against the registers.` });
  }

  return {
    cutoverDate,
    fileName: file.fileName ?? null,
    members,
    loans,
    reserve: r2(reserve),
    profit,
    problems,
    warnings,
    totals: {
      members: members.length,
      savings,
      loans: loans.length,
      lent,
      owed: r2(loans.reduce((s, l) => s + l.outstanding, 0)),
      reserve: r2(reserve),
      absences: absenceTotal,
      bank,
    },
  };
}
