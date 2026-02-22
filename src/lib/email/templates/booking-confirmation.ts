import { emailLayout, emailButton, emailInfoBox, MUTED } from "../layout";

interface ConfirmationParams {
  inviteeName: string;
  eventName: string;
  dateStr: string; // "torsdag 6 mars 2025"
  timeStr: string; // "10:00 – 10:30"
  timezone: string;
  meetLink: string | null;
  cancelUrl: string;
  rescheduleUrl?: string;
}

export function bookingConfirmationEmail(params: ConfirmationParams): {
  subject: string;
  html: string;
} {
  const {
    inviteeName,
    eventName,
    dateStr,
    timeStr,
    timezone,
    meetLink,
    cancelUrl,
  } = params;

  const firstName = inviteeName.split(" ")[0];

  const infoLines = [
    `<strong>${eventName}</strong>`,
    `📅 ${dateStr}`,
    `🕐 ${timeStr} (${timezone})`,
  ];

  if (meetLink) {
    infoLines.push(
      `📹 <a href="${meetLink}" style="color:#5e3a8c;text-decoration:underline">Anslut via Google Meet</a>`
    );
  }

  const html = emailLayout({
    preheader: `Din bokning är bekräftad: ${eventName} – ${dateStr} ${timeStr}`,
    children: `
      <h1 style="margin:0 0 8px;font-size:22px;color:#1f2937">Bokning bekräftad!</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${MUTED}">
        Hej ${firstName}, din bokning är bekräftad.
      </p>
      ${emailInfoBox(infoLines)}
      ${meetLink ? emailButton("Öppna Google Meet", meetLink) : ""}
      <p style="margin:24px 0 0;font-size:13px;color:${MUTED}">
        Behöver du ändra? 
        <a href="${cancelUrl}" style="color:#5e3a8c;text-decoration:underline">Avboka mötet</a>
      </p>
    `,
  });

  return {
    subject: `Bekräftad: ${eventName} – ${dateStr} ${timeStr}`,
    html,
  };
}
