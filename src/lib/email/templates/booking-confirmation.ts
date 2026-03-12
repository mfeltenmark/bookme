import { emailLayout, emailButton, emailInfoBox, MUTED } from "../layout";

interface AnswerInfo {
  question_label: string;
  answer: string;
}

interface ConfirmationParams {
  inviteeName: string;
  eventName: string;
  dateStr: string;
  timeStr: string;
  timezone: string;
  meetLink: string | null;
  cancelUrl: string;
  confirmationMessage?: string | null;
  answers?: AnswerInfo[];
  startTime?: string;
  endTime?: string;
}

export function bookingConfirmationEmail(params: ConfirmationParams): { subject: string; html: string } {
  const { inviteeName, eventName, dateStr, timeStr, timezone, meetLink, cancelUrl, confirmationMessage, answers, startTime, endTime } = params;

  // Google Calendar add-to-calendar URL
  let addToCalendarUrl = '';
  if (startTime && endTime) {
    const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const title = encodeURIComponent(`${eventName}`);
    const details = encodeURIComponent(meetLink ? `Join via Google Meet: ${meetLink}` : '');
    addToCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(startTime)}/${fmt(endTime)}&details=${details}`;
  }
  const firstName = inviteeName.split(" ")[0];

  const infoLines = [
    `<strong>${eventName}</strong>`,
    `📅 ${dateStr}`,
    `🕐 ${timeStr} (${timezone})`,
  ];
  if (meetLink) {
    infoLines.push(`📹 <a href="${meetLink}" style="color:#5e3a8c;text-decoration:underline">Join via Google Meet</a>`);
  }

  // Custom confirmation message block
  let customMessageBlock = "";
  if (confirmationMessage) {
    const formatted = confirmationMessage
      .replace(/\n/g, "<br>")
      .replace(/✓/g, "✅");
    customMessageBlock = `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:20px 0;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0">
        <tr>
          <td style="padding:16px 20px;font-size:14px;color:#1f2937;line-height:1.6">
            ${formatted}
          </td>
        </tr>
      </table>
    `;
  }

  // Answers summary block
  let answersBlock = "";
  if (answers && answers.length > 0) {
    const answerLines = answers.map(
      (a) => `<p style="margin:4px 0;font-size:13px;color:#4b5563"><strong>${a.question_label}:</strong> ${a.answer}</p>`
    ).join("");
    answersBlock = `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
        <tr>
          <td style="padding:12px 16px">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Your details</p>
            ${answerLines}
          </td>
        </tr>
      </table>
    `;
  }

  const html = emailLayout({
    preheader: `Your booking is confirmed: ${eventName} – ${dateStr} ${timeStr}`,
    children: `
      <h1 style="margin:0 0 8px;font-size:22px;color:#1f2937">Booking confirmed!</h1>
      <p style="margin:0 0 20px;font-size:15px;color:${MUTED}">Hi ${firstName}, your booking has been confirmed.</p>
      ${emailInfoBox(infoLines)}
      ${customMessageBlock}
      ${answersBlock}
      ${meetLink ? emailButton("Open Google Meet", meetLink) : ""}
      ${addToCalendarUrl ? `<p style="margin:16px 0 0;font-size:13px"><a href="${addToCalendarUrl}" style="color:#5e3a8c;text-decoration:underline">📅 Add to Google Calendar</a></p>` : ''}
      <p style="margin:8px 0 0;font-size:13px;color:${MUTED}">Need to make changes? <a href="${cancelUrl}" style="color:#5e3a8c;text-decoration:underline">Cancel this meeting</a></p>
    `,
  });

  return { subject: `Confirmed: ${eventName} – ${dateStr} ${timeStr}`, html };
}
