import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { bookingReminderEmail } from "@/lib/email/templates/booking-reminder";
import { formatEmailDate, formatEmailTime, getCancelUrl } from "@/lib/email/helpers";
import { addHours } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceRoleClient();

  // Get admin settings for timezone
  const { data: adminSettings } = await supabase
    .from("admin_settings")
    .select("timezone")
    .single();

  const tz = adminSettings?.timezone || "Europe/Stockholm";
  const now = new Date();
  const in24h = addHours(now, 24);

  // Find bookings starting within the next 24 hours that haven't been reminded
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, event_type:event_types(name, slug)")
    .eq("status", "confirmed")
    .eq("reminder_sent", false)
    .gte("start_time", now.toISOString())
    .lte("start_time", in24h.toISOString());

  if (error) {
    console.error("Reminder query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0, message: "No reminders to send" });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const booking of bookings) {
    const eventType = booking.event_type as { name: string; slug: string } | null;
    if (!eventType) continue;

    const cancelUrl = getCancelUrl(booking.id, booking.cancellation_token);

    const emailContent = bookingReminderEmail({
      inviteeName: booking.invitee_name,
      eventName: eventType.name,
      dateStr: formatEmailDate(booking.start_time, tz),
      timeStr: formatEmailTime(booking.start_time, booking.end_time, tz),
      timezone: tz,
      meetLink: booking.google_meet_link,
      cancelUrl,
    });

    const success = await sendEmail({
      to: booking.invitee_email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    if (success) {
      // Mark reminder as sent
      await supabase
        .from("bookings")
        .update({ reminder_sent: true })
        .eq("id", booking.id);
      sent++;
    } else {
      errors.push(`Failed: ${booking.invitee_email} (${booking.id})`);
    }
  }

  return NextResponse.json({
    sent,
    total: bookings.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
