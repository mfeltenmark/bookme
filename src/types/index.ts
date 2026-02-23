export interface AdminSettings {
  id: string;
  display_name: string;
  profile_image_url: string | null;
  welcome_message: string | null;
  timezone: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: string | null;
  google_calendar_id: string | null;
  min_notice_hours: number;
  max_days_ahead: number;
  created_at: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  color: string;
  is_active: boolean;
  location_type: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityRule {
  id: string;
  event_type_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface Booking {
  id: string;
  event_type_id: string;
  invitee_name: string;
  invitee_email: string;
  invitee_notes: string | null;
  start_time: string;
  end_time: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  google_event_id: string | null;
  google_meet_link: string | null;
  reminder_sent: boolean;
  cancellation_token: string;
  created_at: string;
  cancelled_at: string | null;
  event_type?: EventType;
}

export interface MeetingPoll {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  expires_at: string | null;
  is_closed: boolean;
  created_at: string;
  options?: PollOption[];
}

export interface PollOption {
  id: string;
  poll_id: string;
  date_time: string;
  duration_minutes: number;
  votes?: PollVote[];
}

export interface PollVote {
  id: string;
  poll_option_id: string;
  voter_name: string;
  voter_email: string;
  availability: "yes" | "maybe" | "no";
  created_at: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Monday",
  1: "Tuesday",
  2: "Wednesday",
  3: "Thursday",
  4: "Friday",
  5: "Saturday",
  6: "Sunday",
};
