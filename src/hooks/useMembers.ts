import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
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
    try {
      const data = await dbQuery<DbMember>('SELECT * FROM public.members ORDER BY created_at DESC');
      setMembers(data);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load members", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const addMember = async (formData: MemberFormData) => {
    try {
      const rows = await dbQuery<DbMember>(
        'INSERT INTO public.members (name, father_name, email, phone, address, dob, join_date, profile_picture, is_approved) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING *',
        [formData.name, formData.father_name, formData.email, formData.phone, formData.address, formData.dob, formData.join_date, formData.profile_picture || null]
      );
      const createdMember = rows[0];
      toast({ title: "Member Added", description: `${formData.name} has been successfully added.` });
      await fetchMembers();
      return createdMember;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add member", variant: "destructive" });
      return null;
    }
  };

  const updateMember = async (id: string, formData: Partial<MemberFormData>) => {
    try {
      await dbQuery(
        'UPDATE public.members SET name=$1, father_name=$2, email=$3, phone=$4, address=$5, dob=$6, join_date=$7, profile_picture=$8 WHERE id=$9',
        [formData.name, formData.father_name, formData.email, formData.phone, formData.address, formData.dob, formData.join_date, formData.profile_picture, id]
      );
      toast({ title: "Member Updated", description: "Member has been successfully updated." });
      await fetchMembers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update member", variant: "destructive" });
      return false;
    }
  };

  const deleteMember = async (id: string, name: string) => {
    try {
      await dbQuery('DELETE FROM public.members WHERE id=$1', [id]);
      toast({ title: "Member Deleted", description: `${name} has been removed.` });
      await fetchMembers();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete member", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  return { members, isLoading, fetchMembers, addMember, updateMember, deleteMember };
}
