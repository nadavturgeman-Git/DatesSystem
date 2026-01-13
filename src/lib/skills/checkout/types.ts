/**
 * Checkout Types
 *
 * TypeScript type definitions for the Hybrid Checkout System.
 * Supports multiple payment methods: Credit Card, Bit, Paybox, Cash
 */

import type { PaymentMethod, PaymentStatus, OrderStatus } from '@/lib/types/database'

// ============================================================================
// Payment Provider Types
// ============================================================================

/**
 * Supported payment provider identifiers
 */
export type PaymentProvider = 'credit_card' | 'bit' | 'paybox' | 'cash'

/**
 * Payment provider configuration
 */
export interface PaymentProviderConfig {
  provider: PaymentProvider
  apiKey?: string
  merchantId?: string
  webhookUrl?: string
  testMode: boolean
}

/**
 * Payment initiation request
 */
export interface PaymentRequest {
  orderId: string
  amount: number
  currency: string
  distributorId: string
  distributorEmail?: string
  distributorPhone?: string
  description: string
  metadata?: Record<string, any>
}

/**
 * Payment initiation response from provider
 */
export interface PaymentInitiationResponse {
  success: boolean
  transactionId?: string
  paymentUrl?: string
  expiresAt?: Date
  instructions?: string
  error?: PaymentError
}

/**
 * Payment confirmation/webhook data
 */
export interface PaymentConfirmation {
  transactionId: string
  orderId: string
  status: 'completed' | 'failed' | 'pending' | 'cancelled'
  amount: number
  paidAt?: Date
  providerResponse?: Record<string, any>
  error?: PaymentError
}

/**
 * Payment error structure
 */
export interface PaymentError {
  code: string
  message: string
  details?: Record<string, any>
  retryable: boolean
}

// ============================================================================
// Checkout Session Types
// ============================================================================

/**
 * Checkout session status
 */
export type CheckoutStatus =
  | 'initiated'           // Checkout started
  | 'reservations_created' // Stock reserved
  | 'payment_pending'     // Awaiting payment
  | 'payment_processing'  // Payment in progress
  | 'payment_completed'   // Payment successful
  | 'payment_failed'      // Payment failed
  | 'completed'           // Order fulfilled
  | 'cancelled'           // Checkout cancelled
  | 'expired'             // Reservation timeout

/**
 * Checkout session data
 */
export interface CheckoutSession {
  id: string
  orderId: string
  distributorId: string
  paymentMethod: PaymentMethod
  status: CheckoutStatus
  subtotal: number
  totalAmount: number
  reservationExpiresAt: Date
  paymentTransactionId?: string
  paymentUrl?: string
  paymentInstructions?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  metadata?: Record<string, any>
}

/**
 * Checkout initialization request
 */
export interface CheckoutInitRequest {
  orderId: string
  paymentMethod?: PaymentMethod  // Override distributor default
  timeoutMinutes?: number        // Override default 30 min
}

/**
 * Checkout initialization response
 */
export interface CheckoutInitResponse {
  success: boolean
  session?: CheckoutSession
  paymentUrl?: string
  paymentInstructions?: string
  expiresAt?: Date
  error?: CheckoutError
}

/**
 * Checkout error structure
 */
export interface CheckoutError {
  code: CheckoutErrorCode
  message: string
  details?: Record<string, any>
}

/**
 * Checkout error codes
 */
export type CheckoutErrorCode =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ALREADY_PAID'
  | 'ORDER_CANCELLED'
  | 'INSUFFICIENT_STOCK'
  | 'RESERVATION_FAILED'
  | 'RESERVATION_EXPIRED'
  | 'PAYMENT_INIT_FAILED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_TIMEOUT'
  | 'ALLOCATION_FAILED'
  | 'COMMISSION_FAILED'
  | 'INVALID_PAYMENT_METHOD'
  | 'DISTRIBUTOR_NOT_FOUND'
  | 'SYSTEM_ERROR'

// ============================================================================
// Order & Distributor Types (checkout-specific views)
// ============================================================================

/**
 * Order details for checkout
 */
export interface OrderForCheckout {
  id: string
  orderNumber: string
  distributorId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod?: PaymentMethod
  totalWeightKg: number
  subtotal: number
  totalAmount: number
  reservationExpiresAt?: Date
  items: OrderItemForCheckout[]
}

/**
 * Order item for checkout display
 */
export interface OrderItemForCheckout {
  id: string
  productId: string
  productName: string
  quantityKg: number
  pricePerKg: number
  lineTotal: number
}

/**
 * Distributor profile for checkout
 */
export interface DistributorForCheckout {
  id: string
  userId: string
  fullName: string
  email: string
  phone?: string
  preferredPaymentMethod: PaymentMethod
  payboxLink?: string
  accountBalance: number
  prefersCommissionInGoods: boolean
}

// ============================================================================
// Payment Method Specific Types
// ============================================================================

/**
 * Credit card payment data
 */
export interface CreditCardPaymentData {
  cardToken?: string        // For tokenized payments
  last4?: string
  expiryMonth?: number
  expiryYear?: number
}

/**
 * Bit payment data
 */
export interface BitPaymentData {
  phoneNumber: string
  deepLink?: string
  qrCodeUrl?: string
}

/**
 * Paybox payment data
 */
export interface PayboxPaymentData {
  paymentLink: string
  linkExpiresAt: Date
  isGenerated: boolean
}

/**
 * Cash payment data
 */
export interface CashPaymentData {
  collectionPoint: string
  collectionInstructions: string
  referenceNumber: string
  expectedCollectionDate?: Date
}

// ============================================================================
// Checkout Result Types
// ============================================================================

/**
 * Complete checkout result
 */
export interface CheckoutResult {
  success: boolean
  orderId: string
  orderNumber?: string
  status: CheckoutStatus
  paymentStatus: PaymentStatus
  commissionCalculated: boolean
  commissionsTotal?: number
  allocationsCreated: boolean
  error?: CheckoutError
  completedAt?: Date
}

/**
 * Payment completion callback result
 */
export interface PaymentCallbackResult {
  success: boolean
  orderId: string
  transactionId: string
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
  message: string
  error?: CheckoutError
}

// ============================================================================
// Checkout UI Configuration Types
// ============================================================================

/**
 * Payment method UI configuration
 */
export interface PaymentMethodUI {
  method: PaymentMethod
  label: string
  labelHe: string           // Hebrew label
  icon: string
  description: string
  descriptionHe: string
  isDigital: boolean
  requiresRedirect: boolean
  showQrCode: boolean
  estimatedTime: string     // e.g., "Instant", "1-2 business days"
}

/**
 * Checkout page configuration based on distributor
 */
export interface CheckoutUIConfig {
  distributorName: string
  preferredMethod: PaymentMethod
  availableMethods: PaymentMethodUI[]
  accountBalance: number
  canUseAccountBalance: boolean
  showCommissionPreview: boolean
  estimatedCommission?: number
}
