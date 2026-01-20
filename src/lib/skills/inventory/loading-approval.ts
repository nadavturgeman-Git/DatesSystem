/**
 * Loading Approval Workflow
 *
 * Critical: Physical stock (current_weight_kg) only decreases when Admin
 * approves loading/dispatch, NOT when order is paid or reserved.
 *
 * Flow:
 * 1. Order created → Stock reserved (virtual lock)
 * 2. Payment received → Reservation remains, physical stock unchanged
 * 3. Admin approves loading → Reservations converted to allocations, physical stock decreases
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { convertReservationsToAllocations } from '../locking/virtual-lock'

export interface LoadingApprovalResult {
  success: boolean
  orderId: string
  palletsAffected: number
  totalWeightKg: number
  message: string
}

// Helper to extract rows from Drizzle result (handles both formats)
function getRows(result: any): any[] {
  if (Array.isArray(result)) {
    return result
  }
  if (result && Array.isArray(result.rows)) {
    return result.rows
  }
  return []
}

/**
 * Approve order for loading (Admin action)
 * This is when physical stock actually decreases
 */
export async function approveOrderLoading(
  orderId: string,
  adminUserId: string
): Promise<LoadingApprovalResult> {
  // Verify order exists and is paid
  const orderResult = await db.execute(sql`
    SELECT
      o.id,
      o.distributor_id,
      o.payment_status,
      o.status,
      o.total_weight_kg,
      o.loading_approved_at
    FROM orders o
    WHERE o.id = ${orderId}::uuid
  `)

  const orderRows = getRows(orderResult)
  if (orderRows.length === 0) {
    return {
      success: false,
      orderId,
      palletsAffected: 0,
      totalWeightKg: 0,
      message: 'הזמנה לא נמצאה',
    }
  }

  const order = orderRows[0]

  // Check if already approved
  if (order.loading_approved_at) {
    return {
      success: false,
      orderId,
      palletsAffected: 0,
      totalWeightKg: Number(order.total_weight_kg),
      message: 'הזמנה כבר אושרה לטעינה',
    }
  }

  // Verify payment is received
  if (order.payment_status !== 'paid') {
    return {
      success: false,
      orderId,
      palletsAffected: 0,
      totalWeightKg: Number(order.total_weight_kg),
      message: 'לא ניתן לאשר טעינה - התשלום לא התקבל',
    }
  }

  // Get active reservations for this order
  const reservationsResult = await db.execute(sql`
    SELECT
      sr.id,
      sr.pallet_id,
      sr.reserved_weight_kg,
      p.pallet_id as pallet_id_readable
    FROM stock_reservations sr
    JOIN pallets p ON p.id = sr.pallet_id
    WHERE sr.order_id = ${orderId}::uuid
    AND sr.is_active = TRUE
  `)

  const reservationRows = getRows(reservationsResult)
  if (reservationRows.length === 0) {
    return {
      success: false,
      orderId,
      palletsAffected: 0,
      totalWeightKg: Number(order.total_weight_kg),
      message: 'לא נמצאו הזמנות מלאי פעילות להזמנה זו',
    }
  }

  // Convert reservations to allocations (this decreases physical stock)
  const conversionResult = await convertReservationsToAllocations(orderId)

  if (!conversionResult.success) {
    return {
      success: false,
      orderId,
      palletsAffected: 0,
      totalWeightKg: Number(order.total_weight_kg),
      message: conversionResult.message,
    }
  }

  // Update order with loading approval
  await db.execute(sql`
    UPDATE orders
    SET
      loading_approved_at = NOW(),
      loading_approved_by = ${adminUserId}::uuid,
      status = 'packed',
      delivery_status = 'In_Transit'
    WHERE id = ${orderId}::uuid
  `)

  return {
    success: true,
    orderId,
    palletsAffected: reservationRows.length,
    totalWeightKg: Number(order.total_weight_kg),
    message: `טעינה אושרה - ${reservationRows.length} משטחים הוקצו`,
  }
}

/**
 * Get orders pending loading approval
 */
export async function getPendingLoadingApprovals(): Promise<Array<{
  orderId: string
  orderNumber: string
  distributorName: string
  totalWeightKg: number
  totalAmount: number
  paidAt: string
  paymentMethod: string
}>> {
  const result = await db.execute(sql`
    SELECT
      o.id,
      o.order_number,
      p.full_name as distributor_name,
      o.total_weight_kg,
      o.total_amount,
      o.paid_at,
      o.payment_method
    FROM orders o
    JOIN profiles p ON p.id = o.distributor_id
    WHERE o.payment_status = 'paid'
    AND o.loading_approved_at IS NULL
    AND o.status NOT IN ('cancelled')
    ORDER BY o.paid_at ASC
  `)

  const rows = getRows(result)
  return rows.map(row => ({
    orderId: row.id as string,
    orderNumber: row.order_number as string,
    distributorName: row.distributor_name as string,
    totalWeightKg: Number(row.total_weight_kg),
    totalAmount: Number(row.total_amount),
    paidAt: row.paid_at as string,
    paymentMethod: row.payment_method as string || 'unknown',
  }))
}

/**
 * Bulk approve multiple orders for loading
 */
export async function bulkApproveLoading(
  orderIds: string[],
  adminUserId: string
): Promise<{
  success: number
  failed: number
  results: LoadingApprovalResult[]
}> {
  const results: LoadingApprovalResult[] = []
  let successCount = 0
  let failedCount = 0

  for (const orderId of orderIds) {
    const result = await approveOrderLoading(orderId, adminUserId)
    results.push(result)
    if (result.success) {
      successCount++
    } else {
      failedCount++
    }
  }

  return {
    success: successCount,
    failed: failedCount,
    results,
  }
}
