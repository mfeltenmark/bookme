import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { formatTime } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export function formatEmailDate(isoDate: string, timezone: string): string {
  const date = new Date(isoDate);
  return format(date, "EEEE d MMMM yyyy", { locale: sv });
}

export function formatEmailTime(
  startIso: string,
  endIso: string,
  timezone: string
): string {
  return `${formatTime(new Date(startIso), timezone)} – ${formatTime(new Date(endIso), timezone)}`;
}

export function getCancelUrl(bookingId: string, token: string): string {
  return `${APP_URL}/booking/${bookingId}/cancel?token=${token}`;
}

export function getRebookUrl(eventSlug: string): string {
  return `${APP_URL}/${eventSlug}`;
}
