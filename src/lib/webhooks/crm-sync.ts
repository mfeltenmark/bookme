// lib/webhooks/crm-sync.ts
// Replace existing file. Key changes:
//   - Payload now includes eventTypeId, eventTypeName, eventTypeSlug, answers
//   - source uses the value from the booking (no longer hardcoded to "bookme")
//   - variant and campaign forwarded as-is (null if absent)

export interface CRMBookingPayload {
  bookingId: string
  eventTypeId: string
  eventTypeName: string
  eventTypeSlug: string

  name: string
  email: string
  phone?: string | null
  company?: string | null
  notes?: string | null
  answers?: Array<{
    question_id?: string
    question_label: string
    answer: string
  }>

  scheduledDate: string  // ISO datetime
  duration: number       // minutes
  meetingUrl?: string

  // Tracking – use value from booking; never hardcode
  source: string         // e.g. "bookme"
  variant: string | null // e.g. "priority-barbershop"
  campaign: string | null // e.g. "launch-2026-03"

  createdAt: string
}

export async function sendBookingToCRM(payload: CRMBookingPayload): Promise<void> {
  const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL
  const WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET

  if (!CRM_WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.warn('CRM_WEBHOOK_URL or CRM_WEBHOOK_SECRET not set – skipping CRM sync')
    return
  }

  const response = await fetch(`${CRM_WEBHOOK_URL}/api/bookings/incoming`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '(unreadable)')
    throw new Error(`CRM webhook responded ${response.status}: ${text}`)
  }
}
