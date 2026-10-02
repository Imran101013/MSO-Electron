import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

export interface DbAttendance {
  id: string;
  meeting_id: string;
  member_id: string;
  present: boolean;
  /** Not at the meeting but excused: no absence charge, and not counted against their attendance. */
  on_leave: boolean;
  created_at: string;
}

/** How a member is marked at a meeting. "leave" is stored as present = false, on_leave = true. */
export type AttendanceStatus = "present" | "absent" | "leave";

export const attendanceStatus = (a: { present: boolean; on_leave?: boolean | null }): AttendanceStatus =>
  a.present ? "present" : a.on_leave ? "leave" : "absent";

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = { present: "Present", absent: "Absent", leave: "On leave" };

/**
 * The year whose profit has already been shared with this meeting's absences counted, or null if
 * the meeting's attendance can still be changed (absence charges are taken for the meeting's year).
 */
export async function attendanceLockedYear(meetingId: string): Promise<number | null> {
  const [row] = await dbQuery<{ year: number }>(
    `SELECT EXTRACT(YEAR FROM mt.meeting_date)::int AS year FROM public.meetings mt
     WHERE mt.id = $1::uuid AND EXISTS (SELECT 1 FROM public.profit_distributions d WHERE d.profit_year = EXTRACT(YEAR FROM mt.meeting_date)::int)`,
    [meetingId],
  );
  return row ? Number(row.year) : null;
}

/**
 * Changes the attendance of a saved meeting: updates the members whose mark changed and adds the
 * ones not marked before, in one statement. Refused (saved: false) once the meeting's year has been
 * distributed, so the records never disagree with the absence charges already taken.
 */
export async function saveMeetingAttendance(
  meetingId: string,
  rows: { memberId: string; status: AttendanceStatus }[],
): Promise<{ saved: boolean; changed: number }> {
  const [res] = await dbQuery<{ allowed: number; changed: number }>(
    `WITH guard AS (
       SELECT 1 FROM public.meetings mt
       WHERE mt.id = $1::uuid AND NOT EXISTS (SELECT 1 FROM public.profit_distributions d WHERE d.profit_year = EXTRACT(YEAR FROM mt.meeting_date)::int)
     ),
     input AS (
       SELECT * FROM unnest($2::uuid[], $3::boolean[], $4::boolean[]) AS t(member_id, present, on_leave)
       WHERE EXISTS (SELECT 1 FROM guard)
     ),
     upd AS (
       UPDATE public.attendance a SET present = i.present, on_leave = i.on_leave
       FROM input i
       WHERE a.meeting_id = $1::uuid AND a.member_id = i.member_id
         AND (a.present IS DISTINCT FROM i.present OR a.on_leave IS DISTINCT FROM i.on_leave)
       RETURNING a.id
     ),
     ins AS (
       INSERT INTO public.attendance (meeting_id, member_id, present, on_leave)
       SELECT $1::uuid, i.member_id, i.present, i.on_leave FROM input i
       WHERE NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.meeting_id = $1::uuid AND a.member_id = i.member_id)
       RETURNING id
     )
     SELECT (SELECT COUNT(*) FROM guard)::int AS allowed, ((SELECT COUNT(*) FROM upd) + (SELECT COUNT(*) FROM ins))::int AS changed`,
    [meetingId, rows.map((r) => r.memberId), rows.map((r) => r.status === "present"), rows.map((r) => r.status === "leave")],
  );
  return { saved: Number(res?.allowed) > 0, changed: Number(res?.changed) || 0 };
}

export interface AttendanceFormData {
  meeting_id: string;
  member_id: string;
  status: AttendanceStatus;
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
    const present = formData.status === "present";
    const onLeave = formData.status === "leave";
    try {
      const existing = await dbQuery<{ id: string }>(
        'SELECT id FROM public.attendance WHERE meeting_id=$1 AND member_id=$2',
        [formData.meeting_id, formData.member_id]
      );
      if (existing.length > 0) {
        await dbQuery('UPDATE public.attendance SET present=$1, on_leave=$2 WHERE id=$3', [present, onLeave, existing[0].id]);
      } else {
        await dbQuery('INSERT INTO public.attendance (meeting_id, member_id, present, on_leave) VALUES ($1,$2,$3,$4)', [formData.meeting_id, formData.member_id, present, onLeave]);
      }
      await fetchAttendance(formData.meeting_id);
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to record attendance", variant: "destructive" });
      return false;
    }
  };

  const bulkRecordAttendance = async (meetingId: string, attendanceList: { memberId: string; status: AttendanceStatus }[]) => {
    try {
      await dbQuery('DELETE FROM public.attendance WHERE meeting_id=$1', [meetingId]);
      for (const item of attendanceList) {
        await dbQuery('INSERT INTO public.attendance (meeting_id, member_id, present, on_leave) VALUES ($1,$2,$3,$4)', [meetingId, item.memberId, item.status === "present", item.status === "leave"]);
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
