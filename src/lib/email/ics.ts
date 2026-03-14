// src/lib/email/ics.ts
// Generates an iCalendar (.ics) string compatible with Outlook, Apple Calendar, and Google Calendar.

export function generateICS(params: {
  uid: string
  summary: string
  startTime: string // ISO 8601
  endTime: string   // ISO 8601
  meetLink: string | null
  organizerEmail: string
  attendeeEmail: string
  attendeeName: string
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const now = fmt(new Date().toISOString())
  const description = params.meetLink
    ? `Join via Google Meet: ${params.meetLink}`
    : 'Booking via BookMe'

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tech & Change//BookMe//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${params.uid}@bookme.techchange.io`,
    `DTSTAMP:${now}`,
    `DTSTART:${fmt(params.startTime)}`,
    `DTEND:${fmt(params.endTime)}`,
    `SUMMARY:${params.summary}`,
    `DESCRIPTION:${description}`,
    params.meetLink ? `LOCATION:${params.meetLink}` : null,
    `ORGANIZER;CN=Mikael Feltenmark:mailto:${params.organizerEmail}`,
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${params.attendeeName}:mailto:${params.attendeeEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  return lines
}
