/**
 * Virtual Locking Skill
 *
 * Implements stock reservation system to prevent overselling.
 * Reserves stock upon order creation with automatic timeout for unpaid orders.
 *
 * Key Features:
 * - Reserve stock when order is created
 * - Automatic expiration for pending payments
 * - Release reservations on timeout or cancellation
 * - Convert reservations to allocations on payment
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { allocateFIFO, type PalletAllocation } from '../inventory/fifo'

export interface ReservationConfig {
  orderId: string
  productId: string
  requestedWeight: number
  timeoutMinutes?: number // Default: 30 minutes
  warehouseId?: string
}

export interface Reservation {
  id: string
  orderId: string
  palletId: string
  reservedWeight: number
  expiresAt: Date
  isActive: boolean
}

const DEFAULT_TIMEOUT_MINUTES = 30

/**
 * Create stock reservations for an order
 * Uses FIFO to determine which pallets to reserve
 */
export async function createReservations(
  config: ReservationConfig
): Promise<{ success: boolean; reservations: Reservation[]; message?: string }> {
  const timeoutMinutes = config.timeoutMinutes || DEFAULT_TIMEOUT_MINUTES
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000)

  // Get FIFO allocation plan
  const fifoResult = await allocateFIFO(
    config.productId,
    config.requestedWeight,
    config.warehouseId
  )

  if (!fifoResult.fullyFulfilled) {
    return {
      success: false,
      reservations: [],
      message: `Insufficient stock. Available: ${fifoResult.totalAllocated}kg, Requested: ${config.requestedWeight}kg`,
    }
  }

  const reservations: Reservation[] = []

  // Create reservation for each pallet allocation
  for (const allocation of fifoResult.allocations) {
    const result = await db.execute(sql`
      INSERT INTO stock_reservations (
        order_id,
        pallet_id,
        reserved_weight_kg,
        expires_at,
        is_active
      )
      VALUES (
        ${config.orderId}::uuid,
        ${allocation.palletId}::uuid,
        ${allocation.allocatedWeight},
        ${expiresAt.toISOString()}::timestamptz,
        TRUE
      )
      RETURNING id, order_id, pallet_id, reserved_weight_kg, expires_at, is_active
    `)

    // Handle both drizzle and raw postgres result formats
    const rows = Array.isArray(result) ? result : (result as any).rows || []
    const row = rows[0]
    
    if (row) {
      reservations.push({
        id: row.id as string,
        orderId: row.order_id as string,
        palletId: row.pallet_id as string,
        reservedWeight: Number(row.reserved_weight_kg),
        expiresAt: new Date(row.expires_at as string),
        isActive: row.is_active as boolean,
      })
    }
  }

  // Update order with expiration time
  await db.execute(sql`
    UPDATE orders
    SET reservation_expires_at = ${expiresAt.toISOString()}::timestamptz
    WHERE id = ${config.orderId}::uuid
  `)

  return {
    success: true,
    reservations,
    message: `Reserved ${config.requestedWeight}kg across ${reservations.length} pallets`,
  }
}

/**
 * Release reservations for an order (on cancellation or timeout)
 */
export async function releaseReservations(orderId: string): Promise<number> {
  const result = await db.execute(sql`
    UPDATE stock_reservations
    SET is_active = FALSE, released_at = NOW()
    WHERE order_id = ${orderId}::uuid
    AND is_active = TRUE
    RETURNING id
  `)

  return result.rowCount || 0
}

/**
 * Convert reservations to permanent allocations (on payment confirmation)
 * This is called when an order is paid and needs to lock in the stock
 */
export async function convertReservationsToAllocations(
  orderId: string
): Promise<{ success: boolean; message: string }> {
  // Get all active reservations for this order
  const reservationsResult = await db.execute(sql`
    SELECT
      sr.id,
      sr.pallet_id,
      sr.reserved_weight_kg,
      sr.expires_at
    FROM stock_reservations sr
    WHERE sr.order_id = ${orderId}::uuid
    AND sr.is_active = TRUE
  `)

  // Handle both drizzle and raw postgres result formats
  const reservationsRows = Array.isArray(reservationsResult) ? reservationsResult : (reservationsResult as any).rows || []
  
  if (reservationsRows.length === 0) {
    return {
      success: false,
      message: 'No active reservations found for this order',
    }
  }

  // Check if reservations have expired
  const now = new Date()
  const hasExpired = reservationsRows.some(
    row => new Date(row.expires_at as string) < now
  )

  if (hasExpired) {
    await releaseReservations(orderId)
    return {
      success: false,
      message: 'Reservations have expired. Stock may no longer be available.',
    }
  }

  // Get order items for this order
  const orderItemsResult = await db.execute(sql`
    SELECT id, product_id, quantity_kg
    FROM order_items
    WHERE order_id = ${orderId}::uuid
  `)

  // Handle both drizzle and raw postgres result formats
  const orderItemsRows = Array.isArray(orderItemsResult) ? orderItemsResult : (orderItemsResult as any).rows || []

  // For each order item, create pallet allocations from reservations
  for (const orderItem of orderItemsRows) {
    const orderItemId = orderItem.id as string
    const productId = orderItem.product_id as string

    // Get reservations for this product
    const productReservations = reservationsRows.filter(
      async r => {
        const palletResult = await db.execute(sql`
          SELECT product_id FROM pallets WHERE id = ${r.pallet_id}::uuid
        `)
        const palletRows = Array.isArray(palletResult) ? palletResult : (palletResult as any).rows || []
        return palletRows[0]?.product_id === productId
      }
    )

    // Create pallet allocations
    for (const reservation of reservationsRows) {
      await db.execute(sql`
        INSERT INTO pallet_allocations (order_item_id, pallet_id, allocated_weight_kg)
        VALUES (
          ${orderItemId}::uuid,
          ${reservation.pallet_id}::uuid,
          ${Number(reservation.reserved_weight_kg)}
        )
      `)

      // Update pallet weight
      await db.execute(sql`
        UPDATE pallets
        SET
          current_weight_kg = current_weight_kg - ${Number(reservation.reserved_weight_kg)},
          is_depleted = CASE
            WHEN current_weight_kg - ${Number(reservation.reserved_weight_kg)} <= 0 THEN TRUE
            ELSE FALSE
          END,
          updated_at = NOW()
        WHERE id = ${reservation.pallet_id}::uuid
      `)
    }
  }

  // Mark reservations as inactive (converted)
  await db.execute(sql`
    UPDATE stock_reservations
    SET is_active = FALSE, released_at = NOW()
    WHERE order_id = ${orderId}::uuid
  `)

  return {
    success: true,
    message: 'Reservations successfully converted to allocations',
  }
}

/**
 * Release all expired reservations (should be run periodically)
 */
export async function releaseExpiredReservations(): Promise<number> {
  const result = await db.execute(sql`SELECT release_expired_reservations()`)
  // Handle both drizzle and raw postgres result formats
  const rows = Array.isArray(result) ? result : (result as any).rows || []
  return Number(rows[0]?.release_expired_reservations || 0)
}

/**
 * Get active reservations for an order
 */
export async function getOrderReservations(orderId: string): Promise<Reservation[]> {
  const result = await db.execute(sql`
    SELECT
      id,
      order_id,
      pallet_id,
      reserved_weight_kg,
      expires_at,
      is_active
    FROM stock_reservations
    WHERE order_id = ${orderId}::uuid
    AND is_active = TRUE
    ORDER BY created_at ASC
  `)

  // Handle both drizzle and raw postgres result formats
  const rows = Array.isArray(result) ? result : (result as any).rows || []
  return rows.map(row => ({
    id: row.id as string,
    orderId: row.order_id as string,
    palletId: row.pallet_id as string,
    reservedWeight: Number(row.reserved_weight_kg),
    expiresAt: new Date(row.expires_at as string),
    isActive: row.is_active as boolean,
  }))
}

/**
 * Extend reservation timeout for an order
 */
export async function extendReservation(
  orderId: string,
  additionalMinutes: number
): Promise<{ success: boolean; newExpiresAt?: Date; message: string }> {
  const result = await db.execute(sql`
    UPDATE stock_reservations
    SET expires_at = expires_at + (${additionalMinutes} || ' minutes')::interval
    WHERE order_id = ${orderId}::uuid
    AND is_active = TRUE
    RETURNING expires_at
  `)

  if (result.rowCount === 0) {
    return {
      success: false,
      message: 'No active reservations found to extend',
    }
  }

  // Handle both drizzle and raw postgres result formats
  const rows = Array.isArray(result) ? result : (result as any).rows || []
  const newExpiresAt = new Date(rows[0]?.expires_at as string)

  // Update order expiration time
  await db.execute(sql`
    UPDATE orders
    SET reservation_expires_at = ${newExpiresAt.toISOString()}::timestamptz
    WHERE id = ${orderId}::uuid
  `)

  return {
    success: true,
    newExpiresAt,
    message: `Reservation extended by ${additionalMinutes} minutes`,
  }
}
