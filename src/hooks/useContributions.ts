import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DbContribution {
  id: string;
  member_id: string;
  meeting_id: string | null;
  amount: number;
  contribution_date: string;
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

  const fetchContributions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("monthly_contributions")
      .select("*")
      .order("contribution_date", { ascending: false });

    if (error) {
      console.error("Error fetching contributions:", error);
      toast({
        title: "Error",
        description: "Failed to load contributions",
        variant: "destructive",
      });
    } else {
      setContributions(data || []);
    }
    setIsLoading(false);
  };

  const addContribution = async (formData: ContributionFormData) => {
    const { data, error } = await supabase
      .from("monthly_contributions")
      .insert({
        member_id: formData.member_id,
        meeting_id: formData.meeting_id || null,
        amount: formData.amount,
        contribution_date: formData.contribution_date,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding contribution:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add contribution",
        variant: "destructive",
      });
      return null;
    }

    // Update member's total_budget
    const { data: member } = await supabase
      .from("members")
      .select("total_budget")
      .eq("id", formData.member_id)
      .single();

    if (member) {
      await supabase
        .from("members")
        .update({ total_budget: (member.total_budget || 0) + formData.amount })
        .eq("id", formData.member_id);
    }

    await fetchContributions();
    return data;
  };

  const bulkAddContributions = async (meetingId: string, contributionsList: { memberId: string; amount: number }[], date: string) => {
    const records = contributionsList
      .filter(c => c.amount > 0)
      .map(item => ({
        member_id: item.memberId,
        meeting_id: meetingId,
        amount: item.amount,
        contribution_date: date,
      }));

    if (records.length === 0) {
      return true;
    }

    const { error } = await supabase
      .from("monthly_contributions")
      .insert(records);

    if (error) {
      console.error("Error recording contributions:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record contributions",
        variant: "destructive",
      });
      return false;
    }

    // Update members' total_budget
    for (const contrib of contributionsList.filter(c => c.amount > 0)) {
      const { data: member } = await supabase
        .from("members")
        .select("total_budget")
        .eq("id", contrib.memberId)
        .single();

      if (member) {
        await supabase
          .from("members")
          .update({ total_budget: (member.total_budget || 0) + contrib.amount })
          .eq("id", contrib.memberId);
      }
    }

    toast({
      title: "Contributions Recorded",
      description: `${records.length} contribution(s) have been saved.`,
    });

    await fetchContributions();
    return true;
  };

  const getMemberContributions = async (memberId: string) => {
    const { data, error } = await supabase
      .from("monthly_contributions")
      .select("*")
      .eq("member_id", memberId)
      .order("contribution_date", { ascending: false });

    if (error) {
      console.error("Error fetching member contributions:", error);
      return [];
    }

    return data || [];
  };

  const getContributionsByMeeting = async (meetingId: string) => {
    const { data, error } = await supabase
      .from("monthly_contributions")
      .select("*, members(name)")
      .eq("meeting_id", meetingId);

    if (error) {
      console.error("Error fetching meeting contributions:", error);
      return [];
    }

    return data || [];
  };

  useEffect(() => {
    fetchContributions();
  }, []);

  return {
    contributions,
    isLoading,
    fetchContributions,
    addContribution,
    bulkAddContributions,
    getMemberContributions,
    getContributionsByMeeting,
  };
}
