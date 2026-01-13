/**
 * Payment Providers Skill
 *
 * Abstracts payment gateway integrations for the Hybrid Checkout System.
 * Supports: Credit Card, Bit, Paybox, and Cash payment methods.
 *
 * Key Features:
 * - Unified interface for all payment providers
 * - Provider-specific implementations
 * - Webhook handling for async payments
 * - Error handling and retry logic
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import type {
  PaymentProvider,
  PaymentProviderConfig,
  PaymentRequest,
  PaymentInitiationResponse,
  PaymentConfirmation,
  PaymentError,
  CreditCardPaymentData,
  BitPaymentData,
  PayboxPaymentData,
  CashPaymentData,
} from './types'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Default payment provider configurations
 * In production, these would come from environment variables
 */
const PROVIDER_CONFIGS: Record<PaymentProvider, PaymentProviderConfig> = {
  credit_card: {
    provider: 'credit_card',
    apiKey: process.env.CREDIT_CARD_API_KEY,
    merchantId: process.env.CREDIT_CARD_MERCHANT_ID,
    webhookUrl: process.env.CREDIT_CARD_WEBHOOK_URL,
    testMode: process.env.NODE_ENV !== 'production',
  },
  bit: {
    provider: 'bit',
    apiKey: process.env.BIT_API_KEY,
    merchantId: process.env.BIT_MERCHANT_ID,
    webhookUrl: process.env.BIT_WEBHOOK_URL,
    testMode: process.env.NODE_ENV !== 'production',
  },
  paybox: {
    provider: 'paybox',
    apiKey: process.env.PAYBOX_API_KEY,
    merchantId: process.env.PAYBOX_MERCHANT_ID,
    webhookUrl: process.env.PAYBOX_WEBHOOK_URL,
    testMode: process.env.NODE_ENV !== 'production',
  },
  cash: {
    provider: 'cash',
    testMode: false,
  },
}

// Default currency
const DEFAULT_CURRENCY = 'ILS'

// Cash collection points
const CASH_COLLECTION_POINTS = {
  jerusalem: {
    name: 'Jerusalem Distribution Center',
    nameHe: 'מרכז חלוקה ירושלים',
    address: 'Jerusalem, Israel',
    instructions: 'Please bring exact amount. Open Sunday-Thursday 8:00-18:00.',
    instructionsHe: 'נא להביא סכום מדויק. פתוח ראשון-חמישי 8:00-18:00.',
  },
  baqaa: {
    name: 'Baqaa Warehouse',
    nameHe: 'מחסן בקעה',
    address: 'Jordan Valley, Israel',
    instructions: 'Payment upon pickup. Bring order confirmation.',
    instructionsHe: 'תשלום בעת האיסוף. נא להביא אישור הזמנה.',
  },
}

// ============================================================================
// Payment Provider Interface
// ============================================================================

/**
 * Abstract payment provider interface
 */
interface IPaymentProvider {
  initiate(request: PaymentRequest): Promise<PaymentInitiationResponse>
  confirm(transactionId: string): Promise<PaymentConfirmation>
  cancel(transactionId: string): Promise<boolean>
  handleWebhook(payload: Record<string, any>): Promise<PaymentConfirmation>
}

// ============================================================================
// Credit Card Provider
// ============================================================================

class CreditCardProvider implements IPaymentProvider {
  private config: PaymentProviderConfig

  constructor(config: PaymentProviderConfig) {
    this.config = config
  }

  async initiate(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      // In production, this would call actual credit card gateway API
      // Example: Tranzila, PayPlus, or similar Israeli payment provider

      if (this.config.testMode) {
        // Test mode: simulate successful initiation
        const transactionId = `cc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const paymentUrl = `https://payment-gateway.example.com/checkout/${transactionId}`

        // Record payment attempt
        await this.recordPaymentAttempt(request.orderId, transactionId, 'initiated')

        return {
          success: true,
          transactionId,
          paymentUrl,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
        }
      }

      // Production implementation would go here
      // const response = await fetch('https://api.payment-provider.com/initiate', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.config.apiKey}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     merchant_id: this.config.merchantId,
      //     amount: request.amount,
      //     currency: request.currency,
      //     order_id: request.orderId,
      //     callback_url: this.config.webhookUrl,
      //     ...
      //   }),
      // })

      throw new Error('Production credit card integration not configured')
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREDIT_CARD_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initiate credit card payment',
          retryable: true,
        },
      }
    }
  }

  async confirm(transactionId: string): Promise<PaymentConfirmation> {
    // In production, verify payment with gateway
    if (this.config.testMode) {
      return {
        transactionId,
        orderId: '', // Would be looked up
        status: 'completed',
        amount: 0, // Would be from gateway
        paidAt: new Date(),
      }
    }

    throw new Error('Production credit card confirmation not configured')
  }

  async cancel(transactionId: string): Promise<boolean> {
    // In production, cancel pending payment
    if (this.config.testMode) {
      return true
    }
    return false
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentConfirmation> {
    // Parse webhook from payment provider
    const transactionId = payload.transaction_id || payload.transactionId
    const status = payload.status === 'success' ? 'completed' : 'failed'
    const orderId = payload.order_id || payload.orderId

    return {
      transactionId,
      orderId,
      status,
      amount: Number(payload.amount || 0),
      paidAt: status === 'completed' ? new Date() : undefined,
      providerResponse: payload,
    }
  }

  private async recordPaymentAttempt(
    orderId: string,
    transactionId: string,
    status: string
  ): Promise<void> {
    // Record in payment_attempts table (would need to add to schema)
    // For now, we track via order status updates
    await db.execute(sql`
      UPDATE orders
      SET
        payment_transaction_id = ${transactionId},
        updated_at = NOW()
      WHERE id = ${orderId}::uuid
    `)
  }
}

// ============================================================================
// Bit Provider
// ============================================================================

class BitProvider implements IPaymentProvider {
  private config: PaymentProviderConfig

  constructor(config: PaymentProviderConfig) {
    this.config = config
  }

  async initiate(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      if (this.config.testMode) {
        // Test mode: simulate Bit payment initiation
        const transactionId = `bit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        // Bit payments use deep links and QR codes
        const phoneNumber = request.distributorPhone || ''
        const bitDeepLink = `bit://send?amount=${request.amount}&reference=${transactionId}`

        await this.recordPaymentAttempt(request.orderId, transactionId, 'initiated')

        return {
          success: true,
          transactionId,
          paymentUrl: bitDeepLink,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes for Bit
          instructions: `Open Bit app and pay ${request.amount} ILS. Reference: ${transactionId}`,
        }
      }

      // Production Bit API integration
      // Would use official Bit Business API
      throw new Error('Production Bit integration not configured')
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'BIT_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initiate Bit payment',
          retryable: true,
        },
      }
    }
  }

  async confirm(transactionId: string): Promise<PaymentConfirmation> {
    if (this.config.testMode) {
      return {
        transactionId,
        orderId: '',
        status: 'completed',
        amount: 0,
        paidAt: new Date(),
      }
    }
    throw new Error('Production Bit confirmation not configured')
  }

  async cancel(transactionId: string): Promise<boolean> {
    if (this.config.testMode) {
      return true
    }
    return false
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentConfirmation> {
    // Bit webhook handling
    return {
      transactionId: payload.reference_id || '',
      orderId: payload.merchant_order_id || '',
      status: payload.status === 'APPROVED' ? 'completed' : 'failed',
      amount: Number(payload.amount || 0),
      paidAt: payload.status === 'APPROVED' ? new Date() : undefined,
      providerResponse: payload,
    }
  }

  private async recordPaymentAttempt(
    orderId: string,
    transactionId: string,
    status: string
  ): Promise<void> {
    await db.execute(sql`
      UPDATE orders
      SET
        payment_transaction_id = ${transactionId},
        updated_at = NOW()
      WHERE id = ${orderId}::uuid
    `)
  }
}

// ============================================================================
// Paybox Provider
// ============================================================================

class PayboxProvider implements IPaymentProvider {
  private config: PaymentProviderConfig

  constructor(config: PaymentProviderConfig) {
    this.config = config
  }

  async initiate(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      if (this.config.testMode) {
        // Test mode: generate payment link
        const transactionId = `paybox_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const paymentLink = `https://paybox.co.il/pay/${this.config.merchantId || 'test'}/${transactionId}?amount=${request.amount}`

        await this.recordPaymentAttempt(request.orderId, transactionId, 'initiated')

        return {
          success: true,
          transactionId,
          paymentUrl: paymentLink,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for Paybox links
          instructions: `Pay via Paybox link: ${paymentLink}`,
        }
      }

      // Production Paybox API integration
      throw new Error('Production Paybox integration not configured')
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'PAYBOX_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to generate Paybox link',
          retryable: true,
        },
      }
    }
  }

  async confirm(transactionId: string): Promise<PaymentConfirmation> {
    if (this.config.testMode) {
      return {
        transactionId,
        orderId: '',
        status: 'completed',
        amount: 0,
        paidAt: new Date(),
      }
    }
    throw new Error('Production Paybox confirmation not configured')
  }

  async cancel(transactionId: string): Promise<boolean> {
    if (this.config.testMode) {
      return true
    }
    return false
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentConfirmation> {
    return {
      transactionId: payload.transactionId || '',
      orderId: payload.orderId || '',
      status: payload.success ? 'completed' : 'failed',
      amount: Number(payload.amount || 0),
      paidAt: payload.success ? new Date() : undefined,
      providerResponse: payload,
    }
  }

  private async recordPaymentAttempt(
    orderId: string,
    transactionId: string,
    status: string
  ): Promise<void> {
    await db.execute(sql`
      UPDATE orders
      SET
        payment_transaction_id = ${transactionId},
        updated_at = NOW()
      WHERE id = ${orderId}::uuid
    `)
  }
}

// ============================================================================
// Cash Provider
// ============================================================================

class CashProvider implements IPaymentProvider {
  private config: PaymentProviderConfig

  constructor(config: PaymentProviderConfig) {
    this.config = config
  }

  async initiate(request: PaymentRequest): Promise<PaymentInitiationResponse> {
    try {
      // Cash payments don't need external provider
      // Generate reference number and instructions
      const referenceNumber = `CASH_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      // Determine collection point based on order metadata or default
      const collectionPoint = request.metadata?.warehouseType === 'freezing'
        ? CASH_COLLECTION_POINTS.baqaa
        : CASH_COLLECTION_POINTS.jerusalem

      const instructions = `
Payment Method: Cash
Amount: ${request.amount} ILS
Reference: ${referenceNumber}

Collection Point: ${collectionPoint.nameHe} (${collectionPoint.name})
${collectionPoint.instructionsHe}

${collectionPoint.instructions}
      `.trim()

      await this.recordCashPayment(request.orderId, referenceNumber)

      return {
        success: true,
        transactionId: referenceNumber,
        instructions,
        // Cash doesn't expire but order reservation does
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CASH_INIT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to initialize cash payment',
          retryable: false,
        },
      }
    }
  }

  async confirm(transactionId: string): Promise<PaymentConfirmation> {
    // Cash confirmation is done manually by admin
    return {
      transactionId,
      orderId: '',
      status: 'pending', // Needs manual confirmation
      amount: 0,
    }
  }

  async cancel(transactionId: string): Promise<boolean> {
    // Cash payments can always be cancelled before collection
    return true
  }

  async handleWebhook(payload: Record<string, any>): Promise<PaymentConfirmation> {
    // Cash doesn't have webhooks - manual confirmation only
    return {
      transactionId: payload.referenceNumber || '',
      orderId: payload.orderId || '',
      status: 'pending',
      amount: Number(payload.amount || 0),
    }
  }

  private async recordCashPayment(orderId: string, referenceNumber: string): Promise<void> {
    await db.execute(sql`
      UPDATE orders
      SET
        payment_transaction_id = ${referenceNumber},
        updated_at = NOW()
      WHERE id = ${orderId}::uuid
    `)
  }
}

// ============================================================================
// Provider Factory
// ============================================================================

/**
 * Get payment provider instance by type
 */
export function getPaymentProvider(provider: PaymentProvider): IPaymentProvider {
  const config = PROVIDER_CONFIGS[provider]

  switch (provider) {
    case 'credit_card':
      return new CreditCardProvider(config)
    case 'bit':
      return new BitProvider(config)
    case 'paybox':
      return new PayboxProvider(config)
    case 'cash':
      return new CashProvider(config)
    default:
      throw new Error(`Unknown payment provider: ${provider}`)
  }
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Initiate payment with specified provider
 */
export async function initiatePayment(
  provider: PaymentProvider,
  request: PaymentRequest
): Promise<PaymentInitiationResponse> {
  const paymentProvider = getPaymentProvider(provider)
  return paymentProvider.initiate({
    ...request,
    currency: request.currency || DEFAULT_CURRENCY,
  })
}

/**
 * Confirm payment status
 */
export async function confirmPayment(
  provider: PaymentProvider,
  transactionId: string
): Promise<PaymentConfirmation> {
  const paymentProvider = getPaymentProvider(provider)
  return paymentProvider.confirm(transactionId)
}

/**
 * Cancel pending payment
 */
export async function cancelPayment(
  provider: PaymentProvider,
  transactionId: string
): Promise<boolean> {
  const paymentProvider = getPaymentProvider(provider)
  return paymentProvider.cancel(transactionId)
}

/**
 * Handle payment webhook from provider
 */
export async function handlePaymentWebhook(
  provider: PaymentProvider,
  payload: Record<string, any>
): Promise<PaymentConfirmation> {
  const paymentProvider = getPaymentProvider(provider)
  return paymentProvider.handleWebhook(payload)
}

/**
 * Manually confirm cash payment (admin only)
 */
export async function confirmCashPayment(
  orderId: string,
  adminUserId: string,
  notes?: string
): Promise<PaymentConfirmation> {
  // Get order details
  const orderResult = await db.execute(sql`
    SELECT id, payment_transaction_id, total_amount
    FROM orders
    WHERE id = ${orderId}::uuid
  `)

  if (orderResult.rows.length === 0) {
    return {
      transactionId: '',
      orderId,
      status: 'failed',
      amount: 0,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found',
        retryable: false,
      },
    }
  }

  const order = orderResult.rows[0]
  const transactionId = order.payment_transaction_id as string

  // Record cash confirmation
  await db.execute(sql`
    UPDATE orders
    SET
      payment_status = 'paid',
      paid_at = NOW(),
      updated_at = NOW()
    WHERE id = ${orderId}::uuid
  `)

  // Log admin action
  await db.execute(sql`
    INSERT INTO admin_actions (
      admin_user_id,
      action_type,
      target_table,
      target_id,
      notes
    )
    VALUES (
      ${adminUserId}::uuid,
      'cash_payment_confirmation',
      'orders',
      ${orderId}::uuid,
      ${notes || 'Cash payment confirmed'}
    )
    ON CONFLICT DO NOTHING
  `)

  return {
    transactionId,
    orderId,
    status: 'completed',
    amount: Number(order.total_amount),
    paidAt: new Date(),
  }
}

/**
 * Check if provider is configured for production
 */
export function isProviderConfigured(provider: PaymentProvider): boolean {
  const config = PROVIDER_CONFIGS[provider]

  if (provider === 'cash') {
    return true // Cash always works
  }

  return !!(config.apiKey && config.merchantId)
}

/**
 * Get all available payment providers
 */
export function getAvailableProviders(): PaymentProvider[] {
  return Object.keys(PROVIDER_CONFIGS).filter(
    provider => isProviderConfigured(provider as PaymentProvider)
  ) as PaymentProvider[]
}

/**
 * Map payment method to provider
 */
export function methodToProvider(method: string): PaymentProvider {
  const mapping: Record<string, PaymentProvider> = {
    credit_card: 'credit_card',
    bit: 'bit',
    paybox: 'paybox',
    cash: 'cash',
  }

  return mapping[method] || 'cash'
}
