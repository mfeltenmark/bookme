import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { calculateAvailability } from "@/lib/availability";
import { getGoogleBusySlots } from "@/lib/google/calendar";
import { addDays } from "date-fns";
import type { TimeSlot } from "@/types";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug parameter" }, { status: 400 });
  }

  const supabase = await createServiceRoleClient();

  // Get event type with availability rules and custom questions
  const { data: eventType, error: etError } = await supabase
    .from("event_types")
    .select("*, availability_rules(*), custom_questions(*)")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (etError || !eventType) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  // Get admin settings
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("*")
    .single();

  if (!settings) {
    return NextResponse.json({ error: "Settings not found" }, { status: 500 });
  }

  // Get existing confirmed bookings as busy slots
  const { data: existingBookings } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("status", "confirmed")
    .gte("start_time", new Date().toISOString());

  const bookingBusySlots: TimeSlot[] = (existingBookings || []).map((b) => ({
    start: new Date(b.start_time),
    end: new Date(b.end_time),
  }));

  // Fetch Google Calendar busy slots
  const now = new Date();
  const maxDate = addDays(now, settings.max_days_ahead);
  const googleBusySlots = await getGoogleBusySlots(now, maxDate);

  // Merge all busy slots
  const busySlots: TimeSlot[] = [...bookingBusySlots, ...googleBusySlots];

  const availability = calculateAvailability({
    rules: eventType.availability_rules || [],
    durationMinutes: eventType.duration_minutes,
    bufferBefore: eventType.buffer_before_minutes,
    bufferAfter: eventType.buffer_after_minutes,
    timezone: settings.timezone,
    minNoticeHours: settings.min_notice_hours,
    maxDaysAhead: settings.max_days_ahead,
    busySlots,
  });

  // Sort custom questions by sort_order
  const questions = (eventType.custom_questions || []).sort(
    (a: any, b: any) => a.sort_order - b.sort_order
  );

  return NextResponse.json({
    eventType: {
      id: eventType.id,
      name: eventType.name,
      slug: eventType.slug,
      description: eventType.description,
      duration_minutes: eventType.duration_minutes,
      color: eventType.color,
      location_type: eventType.location_type,
      confirmation_message: eventType.confirmation_message,
    },
    customQuestions: questions,
    timezone: settings.timezone,
    availability,
  });
}
