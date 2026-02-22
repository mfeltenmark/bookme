import { emailLayout, emailButton, emailInfoBox, MUTED } from "../layout";

interface ReminderParams {
  inviteeName: string;
  eventName: string;
  dateStr: string;
  timeStr: string;
  timezone: string;
  meetLink: string | null;
  cancelUrl: string;
}

export function bookingReminderEmail(params: ReminderParams): {
  subject: string;
  html: string;
} {
  const { inviteeName, eventName, dateStr, timeStr, timezone, meetLink, cancelUrl } =
    params;

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
    preheader: `Påminnelse: ${eventName} imorgon ${timeStr}`,
    children: `
      <h1 style="margin:0 0 8px;font-size:22px;color:#1f2937">Påminnelse om ditt möte</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${MUTED}">
        Hej ${firstName}, bara en påminnelse om ditt kommande möte.
      </p>
      ${emailInfoBox(infoLines)}
      ${meetLink ? emailButton("Öppna Google Meet", meetLink) : ""}
      <p style="margin:24px 0 0;font-size:13px;color:${MUTED}">
        Kan du inte längre? 
        <a href="${cancelUrl}" style="color:#5e3a8c;text-decoration:underline">Avboka mötet</a>
      </p>
    `,
  });

  return {
    subject: `Påminnelse: ${eventName} – ${dateStr} ${timeStr}`,
    html,
  };
}
