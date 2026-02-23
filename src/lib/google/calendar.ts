import { getGoogleCalendarClient } from "./tokens";
import type { TimeSlot } from "@/types";

export async function getGoogleBusySlots(timeMin: Date, timeMax: Date): Promise<TimeSlot[]> {
  const client = await getGoogleCalendarClient();
  if (!client) return [];
  try {
    const res = await client.calendar.freebusy.query({
      requestBody: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(), items: [{ id: client.calendarId }] },
    });
    const busySlots = res.data.calendars?.[client.calendarId]?.busy || [];
    return busySlots.map((slot) => ({ start: new Date(slot.start!), end: new Date(slot.end!) }));
  } catch (err) {
    console.error("Error fetching Google busy slots:", err);
    return [];
  }
}

export async function createCalendarEvent(params: {
  summary: string; description?: string; startTime: string; endTime: string; attendeeEmail: string; attendeeName: string;
}): Promise<{ eventId: string; meetLink: string | null } | null> {
  const client = await getGoogleCalendarClient();
  if (!client) return null;
  try {
    const res = await client.calendar.events.insert({
      calendarId: client.calendarId,
      conferenceDataVersion: 1,
      sendUpdates: "all",
      requestBody: {
        summary: params.summary,
        description: params.description || "",
        start: { dateTime: params.startTime },
        end: { dateTime: params.endTime },
        attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
        conferenceData: { createRequest: { requestId: `bookme-${Date.now()}-${Math.random().toString(36).slice(2)}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
        reminders: { useDefault: false, overrides: [{ method: "email", minutes: 60 }, { method: "popup", minutes: 15 }] },
      },
    });
    const meetLink = res.data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri || null;
    return { eventId: res.data.id!, meetLink };
  } catch (err) {
    console.error("Error creating Google Calendar event:", err);
    return null;
  }
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const client = await getGoogleCalendarClient();
  if (!client) return false;
  try {
    await client.calendar.events.delete({ calendarId: client.calendarId, eventId, sendUpdates: "all" });
    return true;
  } catch (err) {
    console.error("Error deleting Google Calendar event:", err);
    return false;
  }
}

export async function listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
  const client = await getGoogleCalendarClient();
  if (!client) return [];
  try {
    const res = await client.calendar.calendarList.list();
    return (res.data.items || []).map((cal) => ({ id: cal.id!, summary: cal.summary || cal.id!, primary: !!cal.primary }));
  } catch (err) {
    console.error("Error listing calendars:", err);
    return [];
  }
}
