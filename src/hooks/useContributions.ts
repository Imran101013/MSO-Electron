import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { cutoverBlock } from "@/lib/books";

export interface DbContribution {
  id: string;
  member_id: string;
  meeting_id: string | null;
  amount: number;
  contribution_date: string;
  notes: string | null;
  /** The savings balance brought forward from the paper registers at the cut-over date. */
  is_opening?: boolean;
  created_at: string;
}

export interface ContributionFormData {
  member_id: string;
  meeting_id?: string;
  amount: number;
  contribution_date: string;
}

export function useContributions() {
  const [contributions, setContributions] = useState<DbContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

  const fetchContributions = async () => {
    setIsLoading(true);
    try {
      const data = await dbQuery<DbContribution>('SELECT * FROM public.monthly_contributions ORDER BY contribution_date DESC');
      setContributions(data);
    } catch {
      toast({ title: "Error", description: "Failed to load contributions", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const addContribution = async (formData: ContributionFormData) => {
    try {
      const block = await cutoverBlock(formData.contribution_date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return null; }
      const rows = await dbQuery<DbContribution>(
        'INSERT INTO public.monthly_contributions (member_id, meeting_id, amount, contribution_date) VALUES ($1,$2,$3,$4) RETURNING *',
        [formData.member_id, formData.meeting_id || null, formData.amount, formData.contribution_date]
      );
      await dbQuery('UPDATE public.members SET total_budget = total_budget + $1 WHERE id=$2', [formData.amount, formData.member_id]);
      await fetchContributions();
      return rows[0];
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add contribution", variant: "destructive" });
      return null;
    }
  };

  const bulkAddContributions = async (meetingId: string, contributionsList: { memberId: string; amount: number }[], date: string) => {
    const records = contributionsList.filter(c => c.amount > 0);
    if (records.length === 0) return true;
    try {
      const block = await cutoverBlock(date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return false; }
      for (const item of records) {
        await dbQuery(
          'INSERT INTO public.monthly_contributions (member_id, meeting_id, amount, contribution_date) VALUES ($1,$2,$3,$4)',
          [item.memberId, meetingId, item.amount, date]
        );
        await dbQuery('UPDATE public.members SET total_budget = total_budget + $1 WHERE id=$2', [item.amount, item.memberId]);
      }
      toast({ title: "Contributions Recorded", description: `${records.length} contribution(s) have been saved.` });
      await fetchContributions();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record contributions", variant: "destructive" });
      return false;
    }
  };

  const getMemberContributions = async (memberId: string) => {
    try {
      return await dbQuery<DbContribution>('SELECT * FROM public.monthly_contributions WHERE member_id=$1 ORDER BY contribution_date DESC', [memberId]);
    } catch { return []; }
  };

  const getContributionsByMeeting = async (meetingId: string) => {
    try {
      return await dbQuery(
        'SELECT mc.*, m.name FROM public.monthly_contributions mc LEFT JOIN public.members m ON m.id = mc.member_id WHERE mc.meeting_id=$1',
        [meetingId]
      );
    } catch { return []; }
  };

  useEffect(() => { fetchContributions(); }, []);

  return { contributions, isLoading, fetchContributions, addContribution, bulkAddContributions, getMemberContributions, getContributionsByMeeting };
}
