// src/app/api/bookings/route.ts
// Replace the existing file with this version.
// Key changes vs previous:
//   - BookingRequest accepts optional source, variant, campaign
//   - Defaults: source = "bookme", variant = null, campaign = null
//   - These are stored on the booking row and forwarded to CRM webhook

import { createServiceRoleClient } from "@/lib/supabase/server"
import { sendBookingToCRM } from '@/lib/webhooks/crm-sync'
import { getGoogleCalendarClient } from '@/lib/google/tokens'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const BookingRequestSchema = z.object({
  event_type_id: z.string().uuid(),
  name: z.string().min(1).optional(),
  invitee_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  invitee_email: z.string().email().optional(),
  notes: z.string().optional().default(''),
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        question_label: z.string(),
        answer: z.string(),
      })
    )
    .optional()
    .default([]),
  start_time: z.string().datetime(),
  // Tracking fields – all optional, backward compatible
  source: z.string().optional().default('bookme'),
  variant: z.string().nullable().optional().default(null),
  campaign: z.string().nullable().optional().default(null),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = BookingRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.format() },
        { status: 400 }
      )
    }

    const {
      event_type_id,
      name: _name,
      invitee_name,
      email: _email,
      invitee_email,
      notes,
      answers,
      start_time,
      source,
      variant,
      campaign,
    } = parsed.data

    const name = _name ?? invitee_name ?? ''
    const email = _email ?? invitee_email ?? ''

    const supabase = await createServiceRoleClient()

    // 1. Load event type
    const { data: eventType, error: etError } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', event_type_id)
      .eq('is_active', true)
      .single()

    if (etError || !eventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 })
    }

    // 2. Calculate end time
    const startDate = new Date(start_time)
    const endDate = new Date(startDate.getTime() + eventType.duration_minutes * 60 * 1000)

    // 3. Double-check slot availability (guard against race condition)
    const { data: conflict } = await supabase
      .from('bookings')
      .select('id')
      .eq('status', 'confirmed')
      .lt('start_time', endDate.toISOString())
      .gt('end_time', startDate.toISOString())
      .maybeSingle()

    if (conflict) {
      return NextResponse.json(
        { error: 'This time slot is no longer available.' },
        { status: 409 }
      )
    }

    // 4. Create Google Calendar event with Meet link
    let googleEventId: string | null = null
    let googleMeetLink: string | null = null

    try {
      const calendarClient = await getGoogleCalendarClient()

      if (calendarClient) {
        const { calendar, calendarId } = calendarClient
        const event = await calendar.events.insert({
          calendarId,
          conferenceDataVersion: 1,
          requestBody: {
            summary: `${eventType.name} – ${name}`,
            description: notes || undefined,
            start: { dateTime: startDate.toISOString() },
            end: { dateTime: endDate.toISOString() },
            attendees: [{ email }],
            conferenceData: {
              createRequest: { requestId: crypto.randomUUID() },
            },
          },
        })

        googleEventId = event.data.id ?? null
        googleMeetLink =
          event.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')
            ?.uri ?? null
      }
    } catch (calendarError) {
      console.error('Google Calendar error (non-fatal):', calendarError)
    }

    // 5. Persist booking with tracking fields
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        event_type_id,
        invitee_name: name,
        invitee_email: email,
        invitee_notes: notes,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status: 'confirmed',
        google_event_id: googleEventId,
        google_meet_link: googleMeetLink,
        // Tracking
        source: source ?? 'bookme',
        variant: variant ?? null,
        campaign: campaign ?? null,
      })
      .select()
      .single()

    if (bookingError || !booking) {
      console.error('Failed to save booking:', bookingError)
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 })
    }

    // 6. Persist custom question answers
    if (answers.length > 0) {
      await supabase.from('booking_answers').insert(
        answers.map((a) => ({
          booking_id: booking.id,
          question_id: a.question_id,
          question_label: a.question_label,
          answer: a.answer,
        }))
      )
    }

    // 7. Forward to CRM webhook (non-fatal)
    try {
      await sendBookingToCRM({
        bookingId: booking.id,
        eventTypeId: eventType.id,
        eventTypeName: eventType.name,
        eventTypeSlug: eventType.slug,
        name,
        email,
        notes: notes ?? null,
        answers,
        scheduledDate: startDate.toISOString(),
        duration: eventType.duration_minutes,
        meetingUrl: googleMeetLink ?? undefined,
        source: source ?? 'bookme',
        variant: variant ?? null,
        campaign: campaign ?? null,
        createdAt: booking.created_at,
      })
    } catch (crmError) {
      console.error('CRM webhook error (non-fatal):', crmError)
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        start_time: booking.start_time,
        end_time: booking.end_time,
        google_meet_link: booking.google_meet_link,
      },
    })
  } catch (err) {
    console.error('Unexpected error in POST /api/bookings:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
