/**
 * Hybrid Payment Workflow Skill
 *
 * Implements payment workflows based on distributor employment_model:
 * - Credit_Commission: Invoice generation, credit payment
 * - Cash_Paybox: Paybox link display, manual payment confirmation
 * - Goods_Commission: Commission paid in goods
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import type { EmploymentModel } from '@/lib/types/database'

export interface PaymentWorkflowConfig {
  orderId: string
  distributorId: string
  employmentModel: EmploymentModel
  totalAmount: number
}

export interface PaymentWorkflowResult {
  success: boolean
  workflow: EmploymentModel
  paymentUrl?: string // For Paybox
  invoiceId?: string // For Credit/Commission
  requiresManualConfirmation: boolean
  message: string
}

/**
 * Get payment workflow configuration for an order
 */
export async function getPaymentWorkflow(
  orderId: string
): Promise<PaymentWorkflowResult | null> {
  const result = await db.execute(sql`
    SELECT
      o.id,
      o.distributor_id,
      o.total_amount,
      dp.employment_model,
      dp.paybox_link,
      o.payment_status
    FROM orders o
    JOIN distributor_profiles dp ON dp.user_id = o.distributor_id
    WHERE o.id = ${orderId}::uuid
  `)

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  const employmentModel = (row.employment_model || 'Credit_Commission') as EmploymentModel
  const totalAmount = Number(row.total_amount)

  return buildPaymentWorkflow({
    orderId: row.id as string,
    distributorId: row.distributor_id as string,
    employmentModel,
    totalAmount,
    payboxLink: row.paybox_link as string | undefined,
  })
}

/**
 * Build payment workflow based on employment model
 */
function buildPaymentWorkflow(
  config: PaymentWorkflowConfig & { payboxLink?: string }
): PaymentWorkflowResult {
  switch (config.employmentModel) {
    case 'Cash_Paybox':
      return {
        success: true,
        workflow: 'Cash_Paybox',
        paymentUrl: config.payboxLink || undefined,
        requiresManualConfirmation: true,
        message: 'תשלום דרך Paybox - המפיץ יאשר את התשלום ידנית',
      }

    case 'Goods_Commission':
      return {
        success: true,
        workflow: 'Goods_Commission',
        requiresManualConfirmation: false,
        message: 'עמלה תשולם במוצרים - אין צורך בתשלום כספי',
      }

    case 'Credit_Commission':
    default:
      return {
        success: true,
        workflow: 'Credit_Commission',
        requiresManualConfirmation: false,
        message: 'תשלום באשראי - חשבונית תיווצר אוטומטית',
      }
  }
}

/**
 * Process payment for Credit_Commission model (generate invoice)
 */
export async function processCreditPayment(
  orderId: string,
  transactionId: string
): Promise<{ success: boolean; invoiceId?: string; message: string }> {
  // Mock invoice generation (replace with actual iCount/Green Invoice integration)
  const invoiceId = `INV-${Date.now()}-${orderId.slice(0, 8)}`

  // Update order with payment confirmation
  await db.execute(sql`
    UPDATE orders
    SET
      payment_status = 'paid',
      paid_at = NOW(),
      payment_method = 'credit_card'
    WHERE id = ${orderId}::uuid
  `)

  // Generate invoice (mock - replace with actual service)
  // In production, this would call iCount API or Green Invoice API
  console.log(`[MOCK] Invoice generated: ${invoiceId} for order ${orderId}`)

  return {
    success: true,
    invoiceId,
    message: `חשבונית ${invoiceId} נוצרה בהצלחה`,
  }
}

/**
 * Mark cash payment as received (for Cash_Paybox model)
 * Called by distributor when they receive payment
 */
export async function confirmCashPayment(
  orderId: string,
  distributorId: string
): Promise<{ success: boolean; message: string }> {
  // Verify distributor owns this order
  const orderResult = await db.execute(sql`
    SELECT id, distributor_id, payment_status
    FROM orders
    WHERE id = ${orderId}::uuid
    AND distributor_id = ${distributorId}::uuid
  `)

  if (orderResult.rows.length === 0) {
    return {
      success: false,
      message: 'הזמנה לא נמצאה או שאין לך הרשאה',
    }
  }

  const order = orderResult.rows[0]
  if (order.payment_status === 'paid') {
    return {
      success: false,
      message: 'הזמנה כבר שולמה',
    }
  }

  // Update payment status
  await db.execute(sql`
    UPDATE orders
    SET
      payment_status = 'paid',
      paid_at = NOW(),
      payment_method = 'cash'
    WHERE id = ${orderId}::uuid
  `)

  return {
    success: true,
    message: 'תשלום אושר בהצלחה',
  }
}

/**
 * Get payment UI configuration for customer checkout
 */
export async function getPaymentUIConfig(distributorId: string): Promise<{
  employmentModel: EmploymentModel
  showPayboxLink: boolean
  payboxLink?: string
  showCreditCard: boolean
  showCashOption: boolean
  message: string
}> {
  const result = await db.execute(sql`
    SELECT
      dp.employment_model,
      dp.paybox_link
    FROM distributor_profiles dp
    WHERE dp.user_id = ${distributorId}::uuid
  `)

  // Handle both drizzle and raw postgres result formats
  const rows = Array.isArray(result) ? result : (result as any).rows || []
  
  if (rows.length === 0) {
    return {
      employmentModel: 'Credit_Commission',
      showPayboxLink: false,
      showCreditCard: true,
      showCashOption: false,
      message: 'תשלום באשראי',
    }
  }

  const row = rows[0]
  const employmentModel = (row.employment_model || 'Credit_Commission') as EmploymentModel

  switch (employmentModel) {
    case 'Cash_Paybox':
      return {
        employmentModel,
        showPayboxLink: true,
        payboxLink: row.paybox_link as string | undefined,
        showCreditCard: false,
        showCashOption: true,
        message: 'תשלום דרך Paybox',
      }

    case 'Goods_Commission':
      return {
        employmentModel,
        showPayboxLink: false,
        showCreditCard: false,
        showCashOption: false,
        message: 'עמלה במוצרים - אין תשלום נדרש',
      }

    case 'Credit_Commission':
    default:
      return {
        employmentModel,
        showPayboxLink: false,
        showCreditCard: true,
        showCashOption: false,
        message: 'תשלום באשראי',
      }
  }
}
