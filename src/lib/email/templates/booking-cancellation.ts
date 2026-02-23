import { emailLayout, emailInfoBox, MUTED } from "../layout";

interface CancellationParams {
  inviteeName: string;
  eventName: string;
  dateStr: string;
  timeStr: string;
  timezone: string;
  rebookUrl: string;
}

export function bookingCancellationEmail(params: CancellationParams): { subject: string; html: string } {
  const { inviteeName, eventName, dateStr, timeStr, timezone, rebookUrl } = params;
  const firstName = inviteeName.split(" ")[0];

  const html = emailLayout({
    preheader: `Your meeting ${eventName} has been cancelled`,
    children: `
      <h1 style="margin:0 0 8px;font-size:22px;color:#1f2937">Meeting cancelled</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${MUTED}">Hi ${firstName}, your meeting has been cancelled.</p>
      ${emailInfoBox([
        `<strong>${eventName}</strong>`,
        `<s>📅 ${dateStr}</s>`,
        `<s>🕐 ${timeStr} (${timezone})</s>`,
      ])}
      <p style="margin:20px 0 0;font-size:14px;color:#1f2937">Want to reschedule? <a href="${rebookUrl}" style="color:#5e3a8c;text-decoration:underline;font-weight:600">Book a new time</a></p>
    `,
  });

  return { subject: `Cancelled: ${eventName} – ${dateStr}`, html };
}
