import { emailLayout, emailInfoBox, MUTED } from "../layout";

interface CancellationParams {
  inviteeName: string;
  eventName: string;
  dateStr: string;
  timeStr: string;
  timezone: string;
  rebookUrl: string;
}

export function bookingCancellationEmail(params: CancellationParams): {
  subject: string;
  html: string;
} {
  const { inviteeName, eventName, dateStr, timeStr, timezone, rebookUrl } = params;

  const firstName = inviteeName.split(" ")[0];

  const html = emailLayout({
    preheader: `Ditt möte ${eventName} har avbokats`,
    children: `
      <h1 style="margin:0 0 8px;font-size:22px;color:#1f2937">Möte avbokat</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${MUTED}">
        Hej ${firstName}, ditt möte har avbokats.
      </p>
      ${emailInfoBox([
        `<strong>${eventName}</strong>`,
        `<s>📅 ${dateStr}</s>`,
        `<s>🕐 ${timeStr} (${timezone})</s>`,
      ])}
      <p style="margin:20px 0 0;font-size:14px;color:#1f2937">
        Vill du boka en ny tid? 
        <a href="${rebookUrl}" style="color:#5e3a8c;text-decoration:underline;font-weight:600">Boka om</a>
      </p>
    `,
  });

  return {
    subject: `Avbokat: ${eventName} – ${dateStr}`,
    html,
  };
}
