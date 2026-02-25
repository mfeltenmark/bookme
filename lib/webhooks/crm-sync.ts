// lib/webhooks/crm-sync.ts
// Add this to your BookMe project

interface BookingCreatedPayload {
  bookingId: string
  eventType: 'workshop' | '30min-consultation'
  
  // Customer info
  name: string
  email: string
  phone?: string
  company?: string
  
  // Booking details
  scheduledDate: string  // ISO datetime
  duration: number       // minutes
  meetingUrl?: string
  notes?: string
  
  // Metadata
  source: 'bookme'
  createdAt: string
}

interface CRMSyncResponse {
  success: boolean
  lead?: { id: string; title: string; stage: string }
  contact?: { id: string; email: string; name: string }
  activity?: { id: string; scheduledDate: Date }
  tasks?: Array<{ id: string; title: string; dueDate: Date }>
  error?: string
}

/**
 * Send booking to CRM system
 * Call this after a booking is confirmed
 */
export async function sendBookingToCRM(
  booking: BookingCreatedPayload
): Promise<CRMSyncResponse> {
  const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL
  const WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET
  
  if (!CRM_WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.warn('CRM webhook not configured, skipping sync')
    return { success: false, error: 'Not configured' }
  }
  
  try {
    const response = await fetch(`${CRM_WEBHOOK_URL}/api/bookings/incoming`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(booking),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to sync booking to CRM:', errorText)
      
      // Store in retry queue (implement this later)
      await queueForRetry(booking)
      
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      }
    }
    
    const result = await response.json()
    console.log('✅ Booking synced to CRM:', result)
    
    return result
    
  } catch (error) {
    console.error('Error syncing to CRM:', error)
    
    // Store in retry queue
    await queueForRetry(booking)
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Update booking status in CRM (reschedule or cancel)
 */
export async function updateBookingInCRM(
  bookingId: string,
  update: {
    status: 'rescheduled' | 'cancelled'
    newScheduledDate?: string
  }
): Promise<{ success: boolean }> {
  const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL
  const WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET
  
  if (!CRM_WEBHOOK_URL || !WEBHOOK_SECRET) {
    return { success: false }
  }
  
  try {
    const response = await fetch(`${CRM_WEBHOOK_URL}/api/bookings/incoming`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        bookingId,
        ...update,
      }),
    })
    
    return { success: response.ok }
    
  } catch (error) {
    console.error('Error updating booking in CRM:', error)
    return { success: false }
  }
}

/**
 * Simple retry queue using Prisma (you can use Redis or similar)
 */
async function queueForRetry(booking: BookingCreatedPayload) {
  // TODO: Implement proper retry queue
  // For now, just log it
  console.log('📋 Queued for retry:', booking.bookingId)
  
  // You could store in a `webhook_retry_queue` table:
  // await prisma.webhookRetryQueue.create({
  //   data: {
  //     type: 'crm_booking_sync',
  //     payload: booking,
  //     attempts: 0,
  //     maxAttempts: 3,
  //     nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
  //   }
  // })
}

/**
 * Helper to extract booking data from your booking object
 */
export function prepareBookingForCRM(booking: any): BookingCreatedPayload {
  return {
    bookingId: booking.id,
    eventType: booking.eventType.slug, // or however you store this
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    company: booking.company,
    scheduledDate: booking.scheduledStart.toISOString(),
    duration: booking.duration,
    meetingUrl: booking.meetingUrl,
    notes: booking.notes,
    source: 'bookme',
    createdAt: booking.createdAt.toISOString(),
  }
}

/**
 * Example usage in your booking creation endpoint
 */
export async function handleBookingCreated(bookingData: any) {
  // 1. Create booking in your database
  const booking = await createBooking(bookingData)
  
  // 2. Send confirmation email (your existing code)
  await sendConfirmationEmail(booking)
  
  // 3. Sync to CRM (non-blocking, fire-and-forget)
  const crmPayload = prepareBookingForCRM(booking)
  
  // Fire-and-forget approach
  sendBookingToCRM(crmPayload).catch(error => {
    console.error('Background CRM sync failed:', error)
    // This won't block the booking response to the user
  })
  
  return booking
}
