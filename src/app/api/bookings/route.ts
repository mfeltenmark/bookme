import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createCalendarEvent } from "@/lib/google/calendar";
import { sendEmail } from "@/lib/email/send";
import { bookingConfirmationEmail } from "@/lib/email/templates/booking-confirmation";
import { formatEmailDate, formatEmailTime, getCancelUrl } from "@/lib/email/helpers";
import { z } from "zod";

const bookingSchema = z.object({
  event_type_id: z.string().uuid(),
  invitee_name: z.string().min(1, "Name is required"),
  invitee_email: z.string().email("Invalid email address"),
  invitee_notes: z.string().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bookingSchema.parse(body);
    const supabase = await createServiceRoleClient();

    const { data: eventType } = await supabase.from("event_types").select("*").eq("id", parsed.event_type_id).eq("is_active", true).single();
    if (!eventType) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

    const { data: conflicts } = await supabase.from("bookings").select("id").eq("status", "confirmed").lt("start_time", parsed.end_time).gt("end_time", parsed.start_time);
    if (conflicts && conflicts.length > 0) return NextResponse.json({ error: "This time slot is already booked. Please choose another time." }, { status: 409 });

    let googleEventId: string | null = null;
    let googleMeetLink: string | null = null;

    const calResult = await createCalendarEvent({
      summary: `${eventType.name} with ${parsed.invitee_name}`,
      description: parsed.invitee_notes ? `Message from ${parsed.invitee_name}:\n${parsed.invitee_notes}` : `Booking via BookMe`,
      startTime: parsed.start_time,
      endTime: parsed.end_time,
      attendeeEmail: parsed.invitee_email,
      attendeeName: parsed.invitee_name,
    });

    if (calResult) { googleEventId = calResult.eventId; googleMeetLink = calResult.meetLink; }

    const { data: booking, error } = await supabase.from("bookings").insert({
      event_type_id: parsed.event_type_id, invitee_name: parsed.invitee_name, invitee_email: parsed.invitee_email,
      invitee_notes: parsed.invitee_notes || null, start_time: parsed.start_time, end_time: parsed.end_time,
      status: "confirmed", google_event_id: googleEventId, google_meet_link: googleMeetLink,
    }).select().single();

    if (error) { console.error("Booking creation error:", error); return NextResponse.json({ error: "Could not create booking" }, { status: 500 }); }

    const { data: adminSettings } = await supabase.from("admin_settings").select("timezone").single();
    const tz = adminSettings?.timezone || "Europe/Stockholm";
    const cancelUrl = getCancelUrl(booking.id, booking.cancellation_token);

    const emailContent = bookingConfirmationEmail({
      inviteeName: parsed.invitee_name, eventName: eventType.name,
      dateStr: formatEmailDate(parsed.start_time, tz), timeStr: formatEmailTime(parsed.start_time, parsed.end_time, tz),
      timezone: tz, meetLink: googleMeetLink, cancelUrl,
    });

    await sendEmail({ to: parsed.invitee_email, subject: emailContent.subject, html: emailContent.html });

    return NextResponse.json({
      booking: { id: booking.id, start_time: booking.start_time, end_time: booking.end_time, google_meet_link: booking.google_meet_link, cancellation_token: booking.cancellation_token },
      message: "Booking confirmed!",
    });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid input", details: err.issues }, { status: 400 });
    console.error("Booking error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
