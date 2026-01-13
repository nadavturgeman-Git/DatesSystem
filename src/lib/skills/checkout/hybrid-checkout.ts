/**
 * Hybrid Checkout Skill
 *
 * Implements the complete checkout flow for the Date Palm Farm Management System.
 * Supports multiple payment methods with dynamic UI configuration based on distributor profile.
 *
 * Key Features:
 * - Dynamic checkout UI based on distributor payment preferences
 * - Virtual locking integration (30-min timeout)
 * - Multiple payment method support (Credit Card, Bit, Paybox, Cash)
 * - Commission calculation on order completion
 * - Account balance support
 * - Comprehensive error handling
 *
 * Checkout Flow:
 * 1. Validate order and distributor
 * 2. Create stock reservations (virtual lock)
 * 3. Initiate payment based on method
 * 4. On payment success:
 *    - Convert reservations to allocations
 *    - Calculate and record commissions
 *    - Update order status
 * 5. On timeout/failure:
 *    - Release reservations
 *    - Update order status
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { createReservations, releaseReservations, convertReservationsToAllocations, getOrderReservations, extendReservation } from '../locking/virtual-lock'
import { calculateOrderCommissions } from '../commissions/calculator'
import { createAlert } from '../alerts/alert-manager'
import { initiatePayment, confirmPayment, cancelPayment, methodToProvider, isProviderConfigured } from './payment-providers'
import type {
  CheckoutInitRequest,
  CheckoutInitResponse,
  CheckoutSession,
  CheckoutStatus,
  CheckoutResult,
  CheckoutError,
  CheckoutErrorCode,
  OrderForCheckout,
  OrderItemForCheckout,
  DistributorForCheckout,
  CheckoutUIConfig,
  PaymentMethodUI,
  PaymentCallbackResult,
} from './types'
import type { PaymentMethod, OrderStatus, PaymentStatus } from '@/lib/types/database'

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_RESERVATION_TIMEOUT_MINUTES = 30
const CASH_EXTENDED_TIMEOUT_MINUTES = 60 // Cash payments get extended timeout

/**
 * Payment method UI configurations
 */
const PAYMENT_METHOD_UI: Record<PaymentMethod, PaymentMethodUI> = {
  credit_card: {
    method: 'credit_card',
    label: 'Credit Card',
    labelHe: 'כרטיס אשראי',
    icon: 'credit-card',
    description: 'Pay securely with your credit card',
    descriptionHe: 'תשלום מאובטח בכרטיס אשראי',
    isDigital: true,
    requiresRedirect: true,
    showQrCode: false,
    estimatedTime: 'Instant',
  },
  bit: {
    method: 'bit',
    label: 'Bit',
    labelHe: 'ביט',
    icon: 'smartphone',
    description: 'Pay instantly with Bit app',
    descriptionHe: 'תשלום מיידי באפליקציית ביט',
    isDigital: true,
    requiresRedirect: false,
    showQrCode: true,
    estimatedTime: 'Instant',
  },
  paybox: {
    method: 'paybox',
    label: 'Paybox',
    labelHe: 'פייבוקס',
    icon: 'link',
    description: 'Pay via Paybox payment link',
    descriptionHe: 'תשלום דרך קישור פייבוקס',
    isDigital: true,
    requiresRedirect: true,
    showQrCode: false,
    estimatedTime: '1-5 minutes',
  },
  cash: {
    method: 'cash',
    label: 'Cash',
    labelHe: 'מזומן',
    icon: 'banknote',
    description: 'Pay cash at pickup point',
    descriptionHe: 'תשלום במזומן בנקודת האיסוף',
    isDigital: false,
    requiresRedirect: false,
    showQrCode: false,
    estimatedTime: 'Upon pickup',
  },
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create checkout error object
 */
function createError(code: CheckoutErrorCode, message: string, details?: Record<string, any>): CheckoutError {
  return { code, message, details }
}

/**
 * Get order details for checkout
 */
async function getOrderForCheckout(orderId: string): Promise<OrderForCheckout | null> {
  const orderResult = await db.execute(sql`
    SELECT
      o.id,
      o.order_number,
      o.distributor_id,
      o.status,
      o.payment_status,
      o.payment_method,
      o.total_weight_kg,
      o.subtotal,
      o.total_amount,
      o.reservation_expires_at
    FROM orders o
    WHERE o.id = ${orderId}::uuid
  `)

  if (orderResult.rows.length === 0) {
    return null
  }

  const order = orderResult.rows[0]

  // Get order items with product info
  const itemsResult = await db.execute(sql`
    SELECT
      oi.id,
      oi.product_id,
      p.name as product_name,
      oi.quantity_kg,
      oi.price_per_kg,
      oi.line_total
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}::uuid
  `)

  const items: OrderItemForCheckout[] = itemsResult.rows.map(row => ({
    id: row.id as string,
    productId: row.product_id as string,
    productName: row.product_name as string,
    quantityKg: Number(row.quantity_kg),
    pricePerKg: Number(row.price_per_kg),
    lineTotal: Number(row.line_total),
  }))

  return {
    id: order.id as string,
    orderNumber: order.order_number as string,
    distributorId: order.distributor_id as string,
    status: order.status as OrderStatus,
    paymentStatus: order.payment_status as PaymentStatus,
    paymentMethod: order.payment_method as PaymentMethod | undefined,
    totalWeightKg: Number(order.total_weight_kg),
    subtotal: Number(order.subtotal),
    totalAmount: Number(order.total_amount),
    reservationExpiresAt: order.reservation_expires_at
      ? new Date(order.reservation_expires_at as string)
      : undefined,
    items,
  }
}

/**
 * Get distributor details for checkout
 */
async function getDistributorForCheckout(userId: string): Promise<DistributorForCheckout | null> {
  const result = await db.execute(sql`
    SELECT
      dp.id,
      dp.user_id,
      p.full_name,
      p.email,
      p.phone,
      dp.preferred_payment_method,
      dp.paybox_link,
      dp.account_balance,
      dp.prefers_commission_in_goods
    FROM distributor_profiles dp
    JOIN profiles p ON p.id = dp.user_id
    WHERE dp.user_id = ${userId}::uuid
  `)

  if (result.rows.length === 0) {
    return null
  }

  const row = result.rows[0]
  return {
    id: row.id as string,
    userId: row.user_id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: row.phone as string | undefined,
    preferredPaymentMethod: row.preferred_payment_method as PaymentMethod,
    payboxLink: row.paybox_link as string | undefined,
    accountBalance: Number(row.account_balance || 0),
    prefersCommissionInGoods: row.prefers_commission_in_goods as boolean,
  }
}

/**
 * Update order status
 */
async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  paymentStatus: PaymentStatus,
  paymentMethod?: PaymentMethod,
  paidAt?: Date
): Promise<void> {
  await db.execute(sql`
    UPDATE orders
    SET
      status = ${status},
      payment_status = ${paymentStatus},
      ${paymentMethod ? sql`payment_method = ${paymentMethod},` : sql``}
      ${paidAt ? sql`paid_at = ${paidAt.toISOString()}::timestamptz,` : sql``}
      updated_at = NOW()
    WHERE id = ${orderId}::uuid
  `)
}

/**
 * Generate order number if not exists
 */
async function ensureOrderNumber(orderId: string): Promise<string> {
  const result = await db.execute(sql`
    SELECT order_number FROM orders WHERE id = ${orderId}::uuid
  `)

  if (result.rows.length > 0 && result.rows[0].order_number) {
    return result.rows[0].order_number as string
  }

  // Generate new order number: DP-YYYYMMDD-XXXX
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const randomPart = Math.random().toString(36).substr(2, 4).toUpperCase()
  const orderNumber = `DP-${dateStr}-${randomPart}`

  await db.execute(sql`
    UPDATE orders
    SET order_number = ${orderNumber}
    WHERE id = ${orderId}::uuid
  `)

  return orderNumber
}

// ============================================================================
// Core Checkout Functions
// ============================================================================

/**
 * Initialize checkout session
 * Creates stock reservations and prepares payment
 */
export async function initializeCheckout(
  request: CheckoutInitRequest
): Promise<CheckoutInitResponse> {
  const { orderId, paymentMethod: overrideMethod, timeoutMinutes } = request

  // 1. Validate order
  const order = await getOrderForCheckout(orderId)
  if (!order) {
    return {
      success: false,
      error: createError('ORDER_NOT_FOUND', 'Order not found'),
    }
  }

  if (order.paymentStatus === 'paid') {
    return {
      success: false,
      error: createError('ORDER_ALREADY_PAID', 'Order has already been paid'),
    }
  }

  if (order.status === 'cancelled') {
    return {
      success: false,
      error: createError('ORDER_CANCELLED', 'Order has been cancelled'),
    }
  }

  // 2. Get distributor details
  const distributor = await getDistributorForCheckout(order.distributorId)
  if (!distributor) {
    return {
      success: false,
      error: createError('DISTRIBUTOR_NOT_FOUND', 'Distributor profile not found'),
    }
  }

  // 3. Determine payment method
  const paymentMethod = overrideMethod || distributor.preferredPaymentMethod || 'cash'

  // Validate payment method
  if (!isProviderConfigured(methodToProvider(paymentMethod))) {
    return {
      success: false,
      error: createError(
        'INVALID_PAYMENT_METHOD',
        `Payment method ${paymentMethod} is not configured`
      ),
    }
  }

  // 4. Create stock reservations
  // Check if reservations already exist
  const existingReservations = await getOrderReservations(orderId)

  let reservationExpiresAt: Date

  if (existingReservations.length > 0) {
    // Reservations exist - check if still valid
    const earliestExpiry = existingReservations.reduce(
      (min, r) => (r.expiresAt < min ? r.expiresAt : min),
      existingReservations[0].expiresAt
    )

    if (earliestExpiry > new Date()) {
      reservationExpiresAt = earliestExpiry
    } else {
      // Expired - release and create new
      await releaseReservations(orderId)
      // Fall through to create new reservations
    }
  }

  if (!reservationExpiresAt!) {
    // Create new reservations for each order item
    for (const item of order.items) {
      const timeout = paymentMethod === 'cash'
        ? CASH_EXTENDED_TIMEOUT_MINUTES
        : (timeoutMinutes || DEFAULT_RESERVATION_TIMEOUT_MINUTES)

      const reservationResult = await createReservations({
        orderId,
        productId: item.productId,
        requestedWeight: item.quantityKg,
        timeoutMinutes: timeout,
      })

      if (!reservationResult.success) {
        // Release any partial reservations
        await releaseReservations(orderId)

        return {
          success: false,
          error: createError(
            'INSUFFICIENT_STOCK',
            reservationResult.message || 'Failed to reserve stock',
            { productId: item.productId, productName: item.productName }
          ),
        }
      }

      if (reservationResult.reservations.length > 0) {
        reservationExpiresAt = reservationResult.reservations[0].expiresAt
      }
    }
  }

  // 5. Ensure order number
  await ensureOrderNumber(orderId)

  // 6. Initiate payment
  const paymentProvider = methodToProvider(paymentMethod)
  const paymentResult = await initiatePayment(paymentProvider, {
    orderId,
    amount: order.totalAmount,
    currency: 'ILS',
    distributorId: distributor.userId,
    distributorEmail: distributor.email,
    distributorPhone: distributor.phone,
    description: `Date Palm Order - ${order.totalWeightKg}kg`,
    metadata: {
      orderNumber: order.orderNumber,
      distributorName: distributor.fullName,
    },
  })

  if (!paymentResult.success) {
    // Release reservations on payment init failure
    await releaseReservations(orderId)

    return {
      success: false,
      error: createError(
        'PAYMENT_INIT_FAILED',
        paymentResult.error?.message || 'Failed to initialize payment',
        { provider: paymentProvider }
      ),
    }
  }

  // 7. Update order with payment method and status
  await updateOrderStatus(orderId, 'pending', 'pending', paymentMethod)

  // 8. Create checkout session
  const session: CheckoutSession = {
    id: `checkout_${orderId}`,
    orderId,
    distributorId: distributor.userId,
    paymentMethod,
    status: 'payment_pending',
    subtotal: order.subtotal,
    totalAmount: order.totalAmount,
    reservationExpiresAt: reservationExpiresAt!,
    paymentTransactionId: paymentResult.transactionId,
    paymentUrl: paymentResult.paymentUrl,
    paymentInstructions: paymentResult.instructions,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  return {
    success: true,
    session,
    paymentUrl: paymentResult.paymentUrl,
    paymentInstructions: paymentResult.instructions,
    expiresAt: reservationExpiresAt!,
  }
}

/**
 * Complete checkout after payment confirmation
 */
export async function completeCheckout(
  orderId: string,
  transactionId: string
): Promise<CheckoutResult> {
  // 1. Verify order exists and is pending payment
  const order = await getOrderForCheckout(orderId)
  if (!order) {
    return {
      success: false,
      orderId,
      status: 'cancelled',
      paymentStatus: 'failed',
      commissionCalculated: false,
      allocationsCreated: false,
      error: createError('ORDER_NOT_FOUND', 'Order not found'),
    }
  }

  if (order.paymentStatus === 'paid') {
    return {
      success: true,
      orderId,
      orderNumber: order.orderNumber,
      status: 'completed',
      paymentStatus: 'paid',
      commissionCalculated: true,
      allocationsCreated: true,
      completedAt: new Date(),
    }
  }

  // 2. Convert reservations to allocations
  const allocationResult = await convertReservationsToAllocations(orderId)
  if (!allocationResult.success) {
    // Reservations may have expired
    return {
      success: false,
      orderId,
      orderNumber: order.orderNumber,
      status: 'payment_failed',
      paymentStatus: 'failed',
      commissionCalculated: false,
      allocationsCreated: false,
      error: createError('ALLOCATION_FAILED', allocationResult.message),
    }
  }

  // 3. Calculate commissions
  let commissionTotal = 0
  let commissionSuccess = false

  try {
    const commissions = await calculateOrderCommissions(orderId)
    commissionTotal = commissions.distributor.commissionAmount +
      (commissions.teamLeader?.commissionAmount || 0)
    commissionSuccess = true
  } catch (error) {
    // Log error but don't fail checkout
    console.error('Commission calculation failed:', error)
    // Could create alert for admin
    await createAlert(
      'stock_low', // Using existing type - ideally add 'commission_error'
      'Commission calculation failed',
      `Failed to calculate commission for order ${order.orderNumber}`,
      undefined,
      { orderId, error: error instanceof Error ? error.message : 'Unknown error' }
    )
  }

  // 4. Update order status
  await updateOrderStatus(orderId, 'confirmed', 'paid', order.paymentMethod, new Date())

  // 5. Update order with transaction ID
  await db.execute(sql`
    UPDATE orders
    SET
      payment_transaction_id = ${transactionId},
      updated_at = NOW()
    WHERE id = ${orderId}::uuid
  `)

  return {
    success: true,
    orderId,
    orderNumber: order.orderNumber,
    status: 'completed',
    paymentStatus: 'paid',
    commissionCalculated: commissionSuccess,
    commissionsTotal: commissionTotal,
    allocationsCreated: true,
    completedAt: new Date(),
  }
}

/**
 * Cancel checkout and release reservations
 */
export async function cancelCheckout(
  orderId: string,
  reason?: string
): Promise<CheckoutResult> {
  // 1. Get order
  const order = await getOrderForCheckout(orderId)
  if (!order) {
    return {
      success: false,
      orderId,
      status: 'cancelled',
      paymentStatus: 'failed',
      commissionCalculated: false,
      allocationsCreated: false,
      error: createError('ORDER_NOT_FOUND', 'Order not found'),
    }
  }

  // 2. Release any active reservations
  await releaseReservations(orderId)

  // 3. Cancel pending payment if exists
  if (order.paymentMethod) {
    const provider = methodToProvider(order.paymentMethod)
    // Try to cancel payment - ignore failures
    try {
      const transactionResult = await db.execute(sql`
        SELECT payment_transaction_id FROM orders WHERE id = ${orderId}::uuid
      `)
      const transactionId = transactionResult.rows[0]?.payment_transaction_id as string
      if (transactionId) {
        await cancelPayment(provider, transactionId)
      }
    } catch {
      // Ignore cancellation errors
    }
  }

  // 4. Update order status
  await db.execute(sql`
    UPDATE orders
    SET
      status = 'cancelled',
      payment_status = 'failed',
      notes = COALESCE(notes || E'\n', '') || ${`Cancelled: ${reason || 'User cancelled'}`},
      updated_at = NOW()
    WHERE id = ${orderId}::uuid
  `)

  return {
    success: true,
    orderId,
    orderNumber: order.orderNumber,
    status: 'cancelled',
    paymentStatus: 'failed',
    commissionCalculated: false,
    allocationsCreated: false,
  }
}

/**
 * Handle payment callback/webhook
 */
export async function handlePaymentCallback(
  orderId: string,
  transactionId: string,
  success: boolean,
  providerData?: Record<string, any>
): Promise<PaymentCallbackResult> {
  if (success) {
    // Payment successful - complete checkout
    const result = await completeCheckout(orderId, transactionId)

    return {
      success: result.success,
      orderId,
      transactionId,
      orderStatus: result.success ? 'confirmed' : 'pending',
      paymentStatus: result.success ? 'paid' : 'failed',
      message: result.success
        ? 'Payment confirmed and order completed'
        : result.error?.message || 'Failed to complete order',
      error: result.error,
    }
  } else {
    // Payment failed
    const order = await getOrderForCheckout(orderId)

    // Update order status but keep reservations for retry
    await updateOrderStatus(orderId, 'pending', 'failed')

    return {
      success: false,
      orderId,
      transactionId,
      orderStatus: 'pending',
      paymentStatus: 'failed',
      message: 'Payment failed. Reservations are still active for retry.',
      error: createError(
        'PAYMENT_FAILED',
        providerData?.error_message || 'Payment was declined'
      ),
    }
  }
}

/**
 * Extend checkout session timeout
 */
export async function extendCheckoutTimeout(
  orderId: string,
  additionalMinutes: number = 15
): Promise<{ success: boolean; newExpiresAt?: Date; message: string }> {
  return extendReservation(orderId, additionalMinutes)
}

// ============================================================================
// UI Configuration Functions
// ============================================================================

/**
 * Get checkout UI configuration for a distributor
 * Returns dynamic UI based on distributor profile
 */
export async function getCheckoutUIConfig(
  orderId: string
): Promise<CheckoutUIConfig | null> {
  const order = await getOrderForCheckout(orderId)
  if (!order) return null

  const distributor = await getDistributorForCheckout(order.distributorId)
  if (!distributor) return null

  // Determine available payment methods
  const availableMethods: PaymentMethodUI[] = []

  // Add all configured methods
  const allMethods: PaymentMethod[] = ['credit_card', 'bit', 'paybox', 'cash']
  for (const method of allMethods) {
    if (isProviderConfigured(methodToProvider(method))) {
      const methodUI = { ...PAYMENT_METHOD_UI[method] }

      // If distributor has Paybox link, customize the UI
      if (method === 'paybox' && distributor.payboxLink) {
        methodUI.description = `Pay via your Paybox: ${distributor.payboxLink}`
        methodUI.descriptionHe = `תשלום דרך הפייבוקס שלך: ${distributor.payboxLink}`
      }

      availableMethods.push(methodUI)
    }
  }

  // Sort methods - preferred first
  availableMethods.sort((a, b) => {
    if (a.method === distributor.preferredPaymentMethod) return -1
    if (b.method === distributor.preferredPaymentMethod) return 1
    return 0
  })

  // Calculate estimated commission
  let estimatedCommission: number | undefined
  if (distributor.prefersCommissionInGoods || true) { // Always show preview
    // Calculate based on current tiers
    const rate = order.totalWeightKg < 50 ? 15 :
      order.totalWeightKg < 75 ? 17 : 20
    estimatedCommission = Number((order.subtotal * rate / 100).toFixed(2))
  }

  return {
    distributorName: distributor.fullName,
    preferredMethod: distributor.preferredPaymentMethod,
    availableMethods,
    accountBalance: distributor.accountBalance,
    canUseAccountBalance: distributor.accountBalance > 0,
    showCommissionPreview: true,
    estimatedCommission,
  }
}

/**
 * Get payment method UI configuration
 */
export function getPaymentMethodUI(method: PaymentMethod): PaymentMethodUI {
  return PAYMENT_METHOD_UI[method]
}

/**
 * Get all payment methods UI configuration
 */
export function getAllPaymentMethodsUI(): PaymentMethodUI[] {
  return Object.values(PAYMENT_METHOD_UI)
}

// ============================================================================
// Account Balance Functions
// ============================================================================

/**
 * Apply account balance to order
 * Reduces order total and updates account balance
 */
export async function applyAccountBalance(
  orderId: string,
  amountToApply?: number
): Promise<{
  success: boolean
  amountApplied: number
  newOrderTotal: number
  remainingBalance: number
  message: string
}> {
  const order = await getOrderForCheckout(orderId)
  if (!order) {
    return {
      success: false,
      amountApplied: 0,
      newOrderTotal: 0,
      remainingBalance: 0,
      message: 'Order not found',
    }
  }

  const distributor = await getDistributorForCheckout(order.distributorId)
  if (!distributor) {
    return {
      success: false,
      amountApplied: 0,
      newOrderTotal: order.totalAmount,
      remainingBalance: 0,
      message: 'Distributor not found',
    }
  }

  if (distributor.accountBalance <= 0) {
    return {
      success: false,
      amountApplied: 0,
      newOrderTotal: order.totalAmount,
      remainingBalance: 0,
      message: 'No account balance available',
    }
  }

  // Calculate amount to apply
  const maxApplicable = Math.min(distributor.accountBalance, order.totalAmount)
  const toApply = amountToApply
    ? Math.min(amountToApply, maxApplicable)
    : maxApplicable

  const newTotal = order.totalAmount - toApply
  const newBalance = distributor.accountBalance - toApply

  // Update order total
  await db.execute(sql`
    UPDATE orders
    SET
      total_amount = ${newTotal},
      notes = COALESCE(notes || E'\n', '') || ${`Account balance applied: ${toApply} ILS`},
      updated_at = NOW()
    WHERE id = ${orderId}::uuid
  `)

  // Update distributor balance
  await db.execute(sql`
    UPDATE distributor_profiles
    SET
      account_balance = ${newBalance},
      updated_at = NOW()
    WHERE user_id = ${order.distributorId}::uuid
  `)

  return {
    success: true,
    amountApplied: toApply,
    newOrderTotal: newTotal,
    remainingBalance: newBalance,
    message: `Applied ${toApply} ILS from account balance`,
  }
}

// ============================================================================
// Checkout Status Functions
// ============================================================================

/**
 * Get current checkout status for an order
 */
export async function getCheckoutStatus(orderId: string): Promise<{
  status: CheckoutStatus
  order: OrderForCheckout | null
  reservations: number
  reservationExpiresAt?: Date
  timeRemaining?: number
}> {
  const order = await getOrderForCheckout(orderId)
  if (!order) {
    return {
      status: 'cancelled',
      order: null,
      reservations: 0,
    }
  }

  const reservations = await getOrderReservations(orderId)

  // Determine status
  let status: CheckoutStatus

  if (order.status === 'cancelled') {
    status = 'cancelled'
  } else if (order.paymentStatus === 'paid') {
    status = 'completed'
  } else if (reservations.length === 0) {
    status = 'expired'
  } else if (reservations[0].expiresAt < new Date()) {
    status = 'expired'
  } else if (order.paymentStatus === 'pending') {
    status = 'payment_pending'
  } else {
    status = 'initiated'
  }

  const reservationExpiresAt = reservations.length > 0
    ? reservations[0].expiresAt
    : undefined

  const timeRemaining = reservationExpiresAt
    ? Math.max(0, reservationExpiresAt.getTime() - Date.now())
    : undefined

  return {
    status,
    order,
    reservations: reservations.length,
    reservationExpiresAt,
    timeRemaining,
  }
}

/**
 * Check and cleanup expired checkout sessions
 * Should be run periodically
 */
export async function cleanupExpiredCheckouts(): Promise<{
  expiredOrders: number
  releasedReservations: number
}> {
  // Find orders with expired reservations that are still pending
  const expiredOrdersResult = await db.execute(sql`
    SELECT DISTINCT o.id
    FROM orders o
    WHERE o.payment_status = 'pending'
    AND o.reservation_expires_at < NOW()
    AND o.status NOT IN ('cancelled', 'delivered')
  `)

  let releasedReservations = 0

  for (const row of expiredOrdersResult.rows) {
    const orderId = row.id as string

    // Release reservations
    const released = await releaseReservations(orderId)
    releasedReservations += released

    // Update order status
    await db.execute(sql`
      UPDATE orders
      SET
        status = 'cancelled',
        payment_status = 'failed',
        notes = COALESCE(notes || E'\n', '') || 'Reservation expired - auto cancelled',
        updated_at = NOW()
      WHERE id = ${orderId}::uuid
    `)

    // Create alert
    await createAlert(
      'reservation_expired',
      'Checkout Expired',
      `Order reservation expired and was auto-cancelled`,
      undefined,
      { orderId }
    )
  }

  return {
    expiredOrders: expiredOrdersResult.rows.length,
    releasedReservations,
  }
}
