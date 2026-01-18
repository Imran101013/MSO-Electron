import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DbAttendance {
  id: string;
  meeting_id: string;
  member_id: string;
  present: boolean;
  created_at: string;
}

export interface AttendanceFormData {
  meeting_id: string;
  member_id: string;
  present: boolean;
}

export function useAttendance() {
  const [attendance, setAttendance] = useState<DbAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAttendance = async (meetingId?: string) => {
    setIsLoading(true);
    let query = supabase.from("attendance").select("*");
    
    if (meetingId) {
      query = query.eq("meeting_id", meetingId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attendance:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance",
        variant: "destructive",
      });
    } else {
      setAttendance(data || []);
    }
    setIsLoading(false);
  };

  const recordAttendance = async (formData: AttendanceFormData) => {
    // Check if attendance already exists for this meeting/member
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("meeting_id", formData.meeting_id)
      .eq("member_id", formData.member_id)
      .maybeSingle();

    if (existing) {
      // Update existing attendance
      const { error } = await supabase
        .from("attendance")
        .update({ present: formData.present })
        .eq("id", existing.id);

      if (error) {
        console.error("Error updating attendance:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to update attendance",
          variant: "destructive",
        });
        return false;
      }
    } else {
      // Insert new attendance
      const { error } = await supabase
        .from("attendance")
        .insert({
          meeting_id: formData.meeting_id,
          member_id: formData.member_id,
          present: formData.present,
        });

      if (error) {
        console.error("Error recording attendance:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to record attendance",
          variant: "destructive",
        });
        return false;
      }
    }

    await fetchAttendance(formData.meeting_id);
    return true;
  };

  const bulkRecordAttendance = async (meetingId: string, attendanceList: { memberId: string; present: boolean }[]) => {
    // Delete existing attendance for this meeting
    await supabase
      .from("attendance")
      .delete()
      .eq("meeting_id", meetingId);

    // Insert new attendance records
    const records = attendanceList.map(item => ({
      meeting_id: meetingId,
      member_id: item.memberId,
      present: item.present,
    }));

    const { error } = await supabase
      .from("attendance")
      .insert(records);

    if (error) {
      console.error("Error recording bulk attendance:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record attendance",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Attendance Recorded",
      description: "Attendance has been saved successfully.",
    });

    return true;
  };

  const getAttendanceForMeeting = async (meetingId: string) => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("meeting_id", meetingId);

    if (error) {
      console.error("Error fetching meeting attendance:", error);
      return [];
    }

    return data || [];
  };

  const getMemberAttendance = async (memberId: string) => {
    const { data, error } = await supabase
      .from("attendance")
      .select("*, meetings(meeting_date)")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching member attendance:", error);
      return [];
    }

    return data || [];
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  return {
    attendance,
    isLoading,
    fetchAttendance,
    recordAttendance,
    bulkRecordAttendance,
    getAttendanceForMeeting,
    getMemberAttendance,
  };
}
