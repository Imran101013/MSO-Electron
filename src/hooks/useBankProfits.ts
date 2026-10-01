import { useEffect, useState } from "react";
import { dbQuery } from "@/lib/db";
import { cutoverBlock } from "@/lib/books";

/**
 * The bank's profit on the account. It is recorded with the meeting at which it is reported, dated
 * the day the bank credited it, so Total Budget (the bank balance) counts it from then. It is shared
 * out at the July AGM for its profit year, which takes the year's total from these rows. An opening
 * row (is_opening) is the paper registers' bank profit for the year not yet shared at the cut-over.
 */
export interface DbBankProfit {
  id: string;
  meeting_id: string | null;
  /** The meeting it was recorded at (null for the opening row, or if that meeting was deleted). */
  meeting_date: string | null;
  amount: number;
  credited_on: string;
  profit_year: number;
  is_opening: boolean;
  created_at: string;
}

export interface BankProfitInput {
  amount: number;
  /** yyyy-MM-dd */
  creditedOn: string;
  profitYear: number;
  /** yyyy-MM-dd of the meeting it is recorded at. */
  meetingDate: string;
}

const SELECT_SQL = `SELECT b.*, m.meeting_date::text AS meeting_date FROM public.bank_profits b
  LEFT JOIN public.meetings m ON m.id = b.meeting_id ORDER BY b.credited_on, b.created_at`;

const day = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;

/** Why this bank profit can't be recorded, or null when it can. */
export async function bankProfitProblem(input: BankProfitInput, dateFormat: string): Promise<string | null> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return "Enter the bank profit as an amount above 0.";
  if (input.creditedOn > input.meetingDate) return `The bank must have credited it by the meeting date (${day(input.meetingDate)}).`;
  const creditYear = Number(input.creditedOn.slice(0, 4));
  if (input.profitYear !== creditYear && input.profitYear !== creditYear - 1) {
    return `Profit credited on ${day(input.creditedOn)} is for ${creditYear}, or for ${creditYear - 1} if the bank paid last year's profit early in the new year.`;
  }
  const block = await cutoverBlock(input.creditedOn, dateFormat);
  if (block) return block;
  const [done] = await dbQuery<{ n: number }>("SELECT COUNT(*)::int AS n FROM public.profit_distributions WHERE profit_year = $1", [input.profitYear]);
  if (Number(done?.n) > 0) return `The ${input.profitYear} profit has already been distributed, so no more bank profit can be added to it.`;
  return null;
}

/** Saves a bank profit against a meeting; refused if its year has been distributed in the meantime. */
export async function addBankProfit(meetingId: string, input: BankProfitInput): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    `INSERT INTO public.bank_profits (meeting_id, amount, credited_on, profit_year)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (SELECT 1 FROM public.profit_distributions WHERE profit_year = $4)
     RETURNING id`,
    [meetingId, input.amount, input.creditedOn, input.profitYear],
  );
  return rows.length > 0;
}

/** Removes a bank profit recorded at a meeting, while its year hasn't been distributed. */
export async function removeBankProfit(id: string): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    `DELETE FROM public.bank_profits b WHERE b.id = $1 AND NOT b.is_opening
       AND NOT EXISTS (SELECT 1 FROM public.profit_distributions d WHERE d.profit_year = b.profit_year)
     RETURNING b.id`,
    [id],
  );
  return rows.length > 0;
}

export function useBankProfits() {
  const [bankProfits, setBankProfits] = useState<DbBankProfit[]>([]);
  const fetchBankProfits = async () => {
    try {
      setBankProfits(await dbQuery<DbBankProfit>(SELECT_SQL));
    } catch (err) {
      console.error("Error fetching bank profits:", err);
    }
  };
  useEffect(() => { fetchBankProfits(); }, []);
  return { bankProfits, fetchBankProfits };
}
