import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface DbMeeting {
  id: string;
  meeting_date: string;
  agenda: string;
  decisions: string | null;
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

  const fetchMeetings = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: false });

    if (error) {
      console.error("Error fetching meetings:", error);
      toast({
        title: "Error",
        description: "Failed to load meetings",
        variant: "destructive",
      });
    } else {
      setMeetings(data || []);
    }
    setIsLoading(false);
  };

  const fetchUpcomingMeetings = async () => {
    const { data, error } = await supabase
      .from("upcoming_meetings")
      .select("*")
      .gte("meeting_date", new Date().toISOString().split("T")[0])
      .order("meeting_date", { ascending: true });

    if (error) {
      console.error("Error fetching upcoming meetings:", error);
    } else {
      setUpcomingMeetings(data || []);
    }
  };

  const addMeeting = async (formData: MeetingFormData) => {
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        meeting_date: formData.meeting_date,
        agenda: formData.agenda,
        decisions: formData.decisions || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add meeting",
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Meeting Added",
      description: "Meeting has been successfully recorded.",
    });

    await fetchMeetings();
    return data;
  };

  const updateMeeting = async (id: string, formData: Partial<MeetingFormData>) => {
    const { error } = await supabase
      .from("meetings")
      .update({
        meeting_date: formData.meeting_date,
        agenda: formData.agenda,
        decisions: formData.decisions,
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update meeting",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Meeting Updated",
      description: "Meeting has been successfully updated.",
    });

    await fetchMeetings();
    return true;
  };

  const deleteMeeting = async (id: string) => {
    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete meeting",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Meeting Deleted",
      description: "Meeting has been removed.",
    });

    await fetchMeetings();
    return true;
  };

  const addUpcomingMeeting = async (formData: UpcomingMeetingFormData) => {
    const { data, error } = await supabase
      .from("upcoming_meetings")
      .insert({
        meeting_date: formData.meeting_date,
        meeting_time: formData.meeting_time || null,
        venue: formData.venue || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error scheduling meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to schedule meeting",
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Meeting Scheduled",
      description: "Upcoming meeting has been scheduled.",
    });

    await fetchUpcomingMeetings();
    return data;
  };

  const deleteUpcomingMeeting = async (id: string) => {
    const { error } = await supabase
      .from("upcoming_meetings")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting upcoming meeting:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete upcoming meeting",
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Meeting Cancelled",
      description: "Upcoming meeting has been cancelled.",
    });

    await fetchUpcomingMeetings();
    return true;
  };

  useEffect(() => {
    fetchMeetings();
    fetchUpcomingMeetings();
  }, []);

  return {
    meetings,
    upcomingMeetings,
    isLoading,
    fetchMeetings,
    fetchUpcomingMeetings,
    addMeeting,
    updateMeeting,
    deleteMeeting,
    addUpcomingMeeting,
    deleteUpcomingMeeting,
  };
}
