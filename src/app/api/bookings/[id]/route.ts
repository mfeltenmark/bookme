import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { deleteCalendarEvent } from "@/lib/google/calendar";
import { sendEmail } from "@/lib/email/send";
import { bookingCancellationEmail } from "@/lib/email/templates/booking-cancellation";
import { formatEmailDate, formatEmailTime, getRebookUrl } from "@/lib/email/helpers";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action, cancellation_token } = body;

  const supabase = await createServiceRoleClient();

  // Verify booking exists and token matches
  const { data: booking } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Bokning hittades inte" }, { status: 404 });
  }

  // Token-based cancellation (for invitees) or admin
  if (cancellation_token && booking.cancellation_token !== cancellation_token) {
    return NextResponse.json({ error: "Ogiltig token" }, { status: 403 });
  }

  if (action === "cancel") {
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Kunde inte avboka" }, { status: 500 });
    }

    // Delete Google Calendar event if exists
    if (booking.google_event_id) {
      await deleteCalendarEvent(booking.google_event_id);
    }

    // Send cancellation email
    const { data: adminSettings } = await supabase
      .from("admin_settings")
      .select("timezone")
      .single();
    const { data: eventType } = await supabase
      .from("event_types")
      .select("name, slug")
      .eq("id", booking.event_type_id)
      .single();

    const tz = adminSettings?.timezone || "Europe/Stockholm";

    if (eventType) {
      const emailContent = bookingCancellationEmail({
        inviteeName: booking.invitee_name,
        eventName: eventType.name,
        dateStr: formatEmailDate(booking.start_time, tz),
        timeStr: formatEmailTime(booking.start_time, booking.end_time, tz),
        timezone: tz,
        rebookUrl: getRebookUrl(eventType.slug),
      });

      await sendEmail({
        to: booking.invitee_email,
        subject: emailContent.subject,
        html: emailContent.html,
      });
    }

    return NextResponse.json({ message: "Bokningen har avbokats" });
  }

  return NextResponse.json({ error: "Okänd åtgärd" }, { status: 400 });
}
