/**
 * FIFO Inventory Skill
 *
 * Implements First-In-First-Out inventory management for pallet-based tracking.
 * Always suggests picking the oldest pallet first based on entry_date.
 *
 * Key Features:
 * - FIFO allocation based on entry_date
 * - Considers active reservations (virtual locking)
 * - Handles partial pallet fulfillment
 * - Updates pallet weights automatically
 */

import { db } from '@/lib/db/client'
import { eq, and, sql, desc, asc } from 'drizzle-orm'

export interface PalletAllocation {
  palletId: string
  palletIdReadable: string
  allocatedWeight: number
  remainingWeight: number
  entryDate: Date
  warehouseId: string
  batchNumber?: string
}

export interface FIFOAllocationResult {
  allocations: PalletAllocation[]
  totalAllocated: number
  fullyFulfilled: boolean
  shortfall: number
}

/**
 * Get available stock for a product considering active reservations
 */
export async function getAvailableStock(productId: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT get_available_stock(${productId}::uuid) as available_stock
  `)

  return Number(result.rows[0]?.available_stock || 0)
}

/**
 * Allocate pallets using FIFO methodology
 * Returns allocation plan without modifying database
 */
export async function allocateFIFO(
  productId: string,
  requestedWeight: number,
  warehouseId?: string
): Promise<FIFOAllocationResult> {
  // Query pallets ordered by entry_date (oldest first)
  const palletQuery = sql`
    SELECT
      p.id,
      p.pallet_id,
      p.entry_date,
      p.current_weight_kg,
      p.warehouse_id,
      p.batch_number,
      COALESCE(
        (SELECT SUM(reserved_weight_kg)
         FROM stock_reservations
         WHERE pallet_id = p.id
         AND is_active = TRUE
         AND expires_at > NOW()),
        0
      ) as reserved_weight
    FROM pallets p
    WHERE p.product_id = ${productId}::uuid
    AND p.is_depleted = FALSE
    ${warehouseId ? sql`AND p.warehouse_id = ${warehouseId}::uuid` : sql``}
    ORDER BY p.entry_date ASC
  `

  const pallets = await db.execute(palletQuery)

  const allocations: PalletAllocation[] = []
  let remainingToAllocate = requestedWeight
  let totalAllocated = 0

  for (const pallet of pallets.rows) {
    if (remainingToAllocate <= 0) break

    const availableInPallet = Number(pallet.current_weight_kg) - Number(pallet.reserved_weight)

    if (availableInPallet <= 0) continue

    const toAllocate = Math.min(availableInPallet, remainingToAllocate)

    allocations.push({
      palletId: pallet.id as string,
      palletIdReadable: pallet.pallet_id as string,
      allocatedWeight: toAllocate,
      remainingWeight: availableInPallet - toAllocate,
      entryDate: new Date(pallet.entry_date as string),
      warehouseId: pallet.warehouse_id as string,
      batchNumber: pallet.batch_number as string | undefined,
    })

    totalAllocated += toAllocate
    remainingToAllocate -= toAllocate
  }

  return {
    allocations,
    totalAllocated,
    fullyFulfilled: remainingToAllocate <= 0,
    shortfall: Math.max(0, remainingToAllocate),
  }
}

/**
 * Get the oldest pallets for a product (for display/reporting)
 */
export async function getOldestPallets(
  productId: string,
  limit: number = 10
): Promise<PalletAllocation[]> {
  const palletQuery = sql`
    SELECT
      p.id,
      p.pallet_id,
      p.entry_date,
      p.current_weight_kg,
      p.warehouse_id,
      p.batch_number,
      COALESCE(
        (SELECT SUM(reserved_weight_kg)
         FROM stock_reservations
         WHERE pallet_id = p.id
         AND is_active = TRUE
         AND expires_at > NOW()),
        0
      ) as reserved_weight
    FROM pallets p
    WHERE p.product_id = ${productId}::uuid
    AND p.is_depleted = FALSE
    ORDER BY p.entry_date ASC
    LIMIT ${limit}
  `

  const pallets = await db.execute(palletQuery)

  return pallets.rows.map(pallet => ({
    palletId: pallet.id as string,
    palletIdReadable: pallet.pallet_id as string,
    allocatedWeight: 0,
    remainingWeight: Number(pallet.current_weight_kg) - Number(pallet.reserved_weight),
    entryDate: new Date(pallet.entry_date as string),
    warehouseId: pallet.warehouse_id as string,
    batchNumber: pallet.batch_number as string | undefined,
  }))
}

/**
 * Record pallet allocation for an order item
 * This creates pallet_allocations records and updates pallet weights
 */
export async function recordPalletAllocation(
  orderItemId: string,
  allocations: PalletAllocation[]
): Promise<void> {
  for (const allocation of allocations) {
    // Insert pallet allocation record
    await db.execute(sql`
      INSERT INTO pallet_allocations (order_item_id, pallet_id, allocated_weight_kg)
      VALUES (
        ${orderItemId}::uuid,
        ${allocation.palletId}::uuid,
        ${allocation.allocatedWeight}
      )
    `)

    // Update pallet current weight
    await db.execute(sql`
      UPDATE pallets
      SET
        current_weight_kg = current_weight_kg - ${allocation.allocatedWeight},
        is_depleted = CASE
          WHEN current_weight_kg - ${allocation.allocatedWeight} <= 0 THEN TRUE
          ELSE FALSE
        END,
        updated_at = NOW()
      WHERE id = ${allocation.palletId}::uuid
    `)
  }
}

/**
 * Get allocation history for an order item
 */
export async function getAllocationHistory(orderItemId: string): Promise<PalletAllocation[]> {
  const result = await db.execute(sql`
    SELECT
      pa.pallet_id,
      p.pallet_id as pallet_id_readable,
      pa.allocated_weight_kg,
      p.entry_date,
      p.warehouse_id,
      p.batch_number
    FROM pallet_allocations pa
    JOIN pallets p ON p.id = pa.pallet_id
    WHERE pa.order_item_id = ${orderItemId}::uuid
    ORDER BY pa.created_at ASC
  `)

  return result.rows.map(row => ({
    palletId: row.pallet_id as string,
    palletIdReadable: row.pallet_id_readable as string,
    allocatedWeight: Number(row.allocated_weight_kg),
    remainingWeight: 0, // Historical record
    entryDate: new Date(row.entry_date as string),
    warehouseId: row.warehouse_id as string,
    batchNumber: row.batch_number as string | undefined,
  }))
}

/**
 * Check if product has sufficient stock for requested quantity
 */
export async function checkStockAvailability(
  productId: string,
  requestedWeight: number,
  warehouseId?: string
): Promise<{ available: boolean; currentStock: number; shortfall: number }> {
  const result = await allocateFIFO(productId, requestedWeight, warehouseId)

  return {
    available: result.fullyFulfilled,
    currentStock: result.totalAllocated + result.shortfall,
    shortfall: result.shortfall,
  }
}
