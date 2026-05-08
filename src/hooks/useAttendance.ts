import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
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
    try {
      const sql = meetingId
        ? 'SELECT * FROM public.attendance WHERE meeting_id=$1 ORDER BY created_at DESC'
        : 'SELECT * FROM public.attendance ORDER BY created_at DESC';
      const data = await dbQuery<DbAttendance>(sql, meetingId ? [meetingId] : []);
      setAttendance(data);
    } catch {
      toast({ title: "Error", description: "Failed to load attendance", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const recordAttendance = async (formData: AttendanceFormData) => {
    try {
      const existing = await dbQuery<{ id: string }>(
        'SELECT id FROM public.attendance WHERE meeting_id=$1 AND member_id=$2',
        [formData.meeting_id, formData.member_id]
      );
      if (existing.length > 0) {
        await dbQuery('UPDATE public.attendance SET present=$1 WHERE id=$2', [formData.present, existing[0].id]);
      } else {
        await dbQuery('INSERT INTO public.attendance (meeting_id, member_id, present) VALUES ($1,$2,$3)', [formData.meeting_id, formData.member_id, formData.present]);
      }
      await fetchAttendance(formData.meeting_id);
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record attendance", variant: "destructive" });
      return false;
    }
  };

  const bulkRecordAttendance = async (meetingId: string, attendanceList: { memberId: string; present: boolean }[]) => {
    try {
      await dbQuery('DELETE FROM public.attendance WHERE meeting_id=$1', [meetingId]);
      for (const item of attendanceList) {
        await dbQuery('INSERT INTO public.attendance (meeting_id, member_id, present) VALUES ($1,$2,$3)', [meetingId, item.memberId, item.present]);
      }
      toast({ title: "Attendance Recorded", description: "Attendance has been saved successfully." });
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record attendance", variant: "destructive" });
      return false;
    }
  };

  const getAttendanceForMeeting = async (meetingId: string) => {
    try {
      return await dbQuery<DbAttendance>('SELECT * FROM public.attendance WHERE meeting_id=$1', [meetingId]);
    } catch { return []; }
  };

  const getMemberAttendance = async (memberId: string) => {
    try {
      return await dbQuery(
        'SELECT a.*, m.meeting_date FROM public.attendance a LEFT JOIN public.meetings m ON m.id = a.meeting_id WHERE a.member_id=$1 ORDER BY a.created_at DESC',
        [memberId]
      );
    } catch { return []; }
  };

  useEffect(() => { fetchAttendance(); }, []);

  return { attendance, isLoading, fetchAttendance, recordAttendance, bulkRecordAttendance, getAttendanceForMeeting, getMemberAttendance };
}
