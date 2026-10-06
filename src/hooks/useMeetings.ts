import { useState, useEffect } from "react";
import { dbQuery } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { cutoverBlock } from "@/lib/books";

export interface DbMeeting {
  id: string;
  meeting_date: string;
  agenda: string;
  decisions: string | null;
  /** Where it was held (null for meetings recorded before the venue was kept). */
  venue: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbUpcomingMeeting {
  id: string;
  meeting_date: string;
  meeting_time: string | null;
  venue: string | null;
  created_at: string;
}

export interface MeetingFormData {
  meeting_date: string;
  agenda: string;
  decisions?: string;
  venue?: string;
}

export interface UpcomingMeetingFormData {
  meeting_date: string;
  meeting_time?: string;
  venue?: string;
}

export function useMeetings() {
  const [meetings, setMeetings] = useState<DbMeeting[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<DbUpcomingMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { settings } = useSettings();

  const fetchMeetings = async () => {
    setIsLoading(true);
    try {
      const data = await dbQuery<DbMeeting>('SELECT * FROM public.meetings ORDER BY meeting_date DESC');
      setMeetings(data);
    } catch {
      toast({ title: "Error", description: "Failed to load meetings", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const fetchUpcomingMeetings = async () => {
    try {
      const data = await dbQuery<DbUpcomingMeeting>(
        "SELECT * FROM public.upcoming_meetings WHERE meeting_date >= CURRENT_DATE ORDER BY meeting_date ASC"
      );
      setUpcomingMeetings(data);
    } catch (err) {
      console.error("Error fetching upcoming meetings:", err);
    }
  };

  const addMeeting = async (formData: MeetingFormData) => {
    try {
      const block = await cutoverBlock(formData.meeting_date, settings.dateFormat);
      if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return null; }
      const rows = await dbQuery<DbMeeting>(
        'INSERT INTO public.meetings (meeting_date, agenda, decisions, venue) VALUES ($1,$2,$3,$4) RETURNING *',
        [formData.meeting_date, formData.agenda, formData.decisions || null, formData.venue?.trim() || null]
      );
      toast({ title: "Meeting Added", description: "Meeting has been successfully recorded." });
      await fetchMeetings();
      return rows[0];
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add meeting", variant: "destructive" });
      return null;
    }
  };

  const updateMeeting = async (id: string, formData: Partial<MeetingFormData>) => {
    try {
      if (formData.meeting_date) {
        const block = await cutoverBlock(formData.meeting_date, settings.dateFormat);
        if (block) { toast({ title: "Date is before the cut-over", description: block, variant: "destructive" }); return false; }
      }
      await dbQuery(
        'UPDATE public.meetings SET meeting_date=$1, agenda=$2, decisions=$3 WHERE id=$4',
        [formData.meeting_date, formData.agenda, formData.decisions, id]
      );
      toast({ title: "Meeting Updated", description: "Meeting has been successfully updated." });
      await fetchMeetings();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update meeting", variant: "destructive" });
      return false;
    }
  };

  const deleteMeeting = async (id: string) => {
    try {
      await dbQuery('DELETE FROM public.meetings WHERE id=$1', [id]);
      toast({ title: "Meeting Deleted", description: "Meeting has been removed." });
      await fetchMeetings();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete meeting", variant: "destructive" });
      return false;
    }
  };

  const addUpcomingMeeting = async (formData: UpcomingMeetingFormData) => {
    try {
      const rows = await dbQuery<DbUpcomingMeeting>(
        'INSERT INTO public.upcoming_meetings (meeting_date, meeting_time, venue) VALUES ($1,$2,$3) RETURNING *',
        [formData.meeting_date, formData.meeting_time || null, formData.venue || null]
      );
      toast({ title: "Meeting Scheduled", description: "Upcoming meeting has been scheduled." });
      await fetchUpcomingMeetings();
      return rows[0];
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to schedule meeting", variant: "destructive" });
      return null;
    }
  };

  const deleteUpcomingMeeting = async (id: string) => {
    try {
      await dbQuery('DELETE FROM public.upcoming_meetings WHERE id=$1', [id]);
      toast({ title: "Meeting Cancelled", description: "Upcoming meeting has been cancelled." });
      await fetchUpcomingMeetings();
      return true;
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to delete upcoming meeting", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => { fetchMeetings(); fetchUpcomingMeetings(); }, []);

  return { meetings, upcomingMeetings, isLoading, fetchMeetings, fetchUpcomingMeetings, addMeeting, updateMeeting, deleteMeeting, addUpcomingMeeting, deleteUpcomingMeeting };
}
