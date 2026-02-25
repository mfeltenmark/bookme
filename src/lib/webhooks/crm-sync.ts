export async function sendBookingToCRM(payload: any) {
  const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL
  const WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET

  if (!CRM_WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.warn('CRM webhook not configured')
    return { success: false }
  }

  try {
    const response = await fetch(`${CRM_WEBHOOK_URL}/api/bookings/incoming`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error('CRM sync failed:', await response.text())
      return { success: false }
    }

    const result = await response.json()
    console.log('✅ Booking synced to CRM:', result)
    return result
  } catch (error) {
    console.error('Error syncing to CRM:', error)
    return { success: false }
  }
}
