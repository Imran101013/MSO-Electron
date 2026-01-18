import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DbMember {
  id: string;
  user_id: string | null;
  name: string;
  father_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  dob: string | null;
  join_date: string;
  profile_picture: string | null;
  total_budget: number;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberFormData {
  name: string;
  father_name: string;
  email: string;
  phone: string;
  address: string;
  dob: string | null;
  join_date: string;
  profile_picture?: string;
}

export function useMembers() {
  const [members, setMembers] = useState<DbMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMembers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching members:", error);
      toast({
        title: "Error",
        description: "Failed to load members",
        variant: "destructive",
      });
    } else {
      setMembers(data || []);
    }
    setIsLoading(false);
  };

  const addMember = async (formData: MemberFormData) => {
    const { data, error } = await supabase
      .from("members")
      .insert({
        name: formData.name,
        father_name: formData.father_name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        dob: formData.dob,
        join_date: formData.join_date,
        profile_picture: formData.profile_picture || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Member Added",
      description: `${formData.name} has been successfully added.`,
    });

    await fetchMembers();
    return data;
  };

  const updateMember = async (id: string, formData: Partial<MemberFormData>) => {
    const { error } = await supabase
      .from("members")
      .update({
        name: formData.name,
        father_name: formData.father_name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        dob: formData.dob,
        join_date: formData.join_date,
        profile_picture: formData.profile_picture,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update member",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Member Updated",
      description: "Member has been successfully updated.",
    });

    await fetchMembers();
    return true;
  };

  const deleteMember = async (id: string, name: string) => {
    const { error } = await supabase
      .from("members")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete member",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Member Deleted",
      description: `${name} has been removed.`,
    });

    await fetchMembers();
    return true;
  };

  const approveMember = async (id: string, name: string) => {
    const { error } = await supabase
      .from("members")
      .update({ is_approved: true })
      .eq("id", id);

    if (error) {
      console.error("Error approving member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve member",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Member Approved",
      description: `${name} can now sign in.`,
    });

    await fetchMembers();
    return true;
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  return {
    members,
    isLoading,
    fetchMembers,
    addMember,
    updateMember,
    deleteMember,
    approveMember,
  };
}
