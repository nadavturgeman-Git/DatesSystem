/**
 * Pickup Notifications Service
 *
 * Sends SMS/WhatsApp notifications to customers when distributor
 * marks stock as received and ready for pickup.
 *
 * Currently implements mock service - replace with actual Twilio/WhatsApp API
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

export interface PickupNotificationConfig {
  customerId: string
  customerPhone: string
  customerName: string
  orderId: string
  orderNumber: string
  distributorName: string
}

/**
 * Send pickup notification (SMS/WhatsApp)
 * Mock implementation - replace with actual service
 */
export async function sendPickupNotification(
  config: PickupNotificationConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Create notification record
    const notificationResult = await db.execute(sql`
      INSERT INTO notifications (
        recipient_id,
        customer_id,
        order_id,
        type,
        title,
        message,
        sent_at
      )
      VALUES (
        ${config.customerId}::uuid,
        ${config.customerId}::uuid,
        ${config.orderId}::uuid,
        'pickup_ready',
        ${'הזמנה מוכנה לאיסוף'},
        ${`שלום ${config.customerName}, ההזמנה ${config.orderNumber} מוכנה לאיסוף אצל ${config.distributorName}.`},
        NOW()
      )
      RETURNING id
    `)

    const notificationId = notificationResult.rows[0]?.id as string

    // Mock SMS/WhatsApp sending
    // In production, replace with:
    // - Twilio API for SMS
    // - WhatsApp Business API
    // - Or other messaging service

    const message = `שלום ${config.customerName},\nההזמנה ${config.orderNumber} מוכנה לאיסוף אצל ${config.distributorName}.\nתודה!`

    console.log(`[MOCK SMS/WhatsApp] Sending to ${config.customerPhone}:`)
    console.log(message)

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 100))

    return {
      success: true,
      messageId: notificationId,
    }
  } catch (error: any) {
    console.error('Error sending pickup notification:', error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * Send notification via actual service (to be implemented)
 */
async function sendViaTwilio(phone: string, message: string): Promise<void> {
  // TODO: Implement Twilio integration
  // const client = require('twilio')(accountSid, authToken)
  // await client.messages.create({
  //   body: message,
  //   to: phone,
  //   from: twilioPhoneNumber
  // })
}

async function sendViaWhatsApp(phone: string, message: string): Promise<void> {
  // TODO: Implement WhatsApp Business API integration
  // Use Meta WhatsApp Business API or Twilio WhatsApp
}
