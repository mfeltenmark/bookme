// src/lib/email/send.ts
import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

interface EmailAttachment {
  filename: string;
  content: string; // base64
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const from = process.env.EMAIL_FROM || "BookMe <noreply@techchange.io>";

  try {
    const { error } = await getResend().emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      replyTo: params.replyTo,
      attachments: params.attachments,
    });

    if (error) {
      console.error("Resend error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Email send error:", err);
    return false;
  }
}
