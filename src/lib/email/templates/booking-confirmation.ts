import { emailLayout, emailButton, emailInfoBox, MUTED } from "../layout";

interface ConfirmationParams {
  inviteeName: string;
  eventName: string;
  dateStr: string;
  timeStr: string;
  timezone: string;
  meetLink: string | null;
  cancelUrl: string;
}

export function bookingConfirmationEmail(params: ConfirmationParams): { subject: string; html: string } {
  const { inviteeName, eventName, dateStr, timeStr, timezone, meetLink, cancelUrl } = params;
  const firstName = inviteeName.split(" ")[0];

  const infoLines = [
    `<strong>${eventName}</strong>`,
    `📅 ${dateStr}`,
    `🕐 ${timeStr} (${timezone})`,
  ];
  if (meetLink) {
    infoLines.push(`📹 <a href="${meetLink}" style="color:#5e3a8c;text-decoration:underline">Join via Google Meet</a>`);
  }

  const html = emailLayout({
    preheader: `Your booking is confirmed: ${eventName} – ${dateStr} ${timeStr}`,
    children: `
      <h1 style="margin:0 0 8px;font-size:22px;color:#1f2937">Booking confirmed!</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${MUTED}">Hi ${firstName}, your booking has been confirmed.</p>
      ${emailInfoBox(infoLines)}
      ${meetLink ? emailButton("Open Google Meet", meetLink) : ""}
      <p style="margin:24px 0 0;font-size:13px;color:${MUTED}">Need to make changes? <a href="${cancelUrl}" style="color:#5e3a8c;text-decoration:underline">Cancel this meeting</a></p>
    `,
  });

  return { subject: `Confirmed: ${eventName} – ${dateStr} ${timeStr}`, html };
}
