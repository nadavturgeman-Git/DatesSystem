/**
 * Delivery Sheet Generator Skill
 *
 * Generates delivery sheets for drivers with per-hub quantities and spare inventory.
 *
 * Key Features:
 * - Generate sheets for specific delivery dates
 * - Include all pending/confirmed orders
 * - Add manager-designated spare inventory
 * - Track commission merchandise allocations
 * - Mark deliveries as completed
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

export interface DeliverySheetItem {
  distributorId: string
  distributorName: string
  productId: string
  productName: string
  quantityKg: number
  isCommissionGoods: boolean
  delivered: boolean
}

export interface DeliverySheet {
  id: string
  sheetNumber: string
  driverName?: string
  deliveryDate: Date
  spareInventoryKg: number
  totalWeightKg: number // Total weight of all items
  totalVolumeM3?: number // Total volume in cubic meters (if calculated)
  notes?: string
  items: DeliverySheetItem[]
  createdBy: string
  createdAt: Date
  completedAt?: Date
}

/**
 * Generate sheet number (format: DS-YYYYMMDD-XXX)
 */
async function generateSheetNumber(deliveryDate: Date): Promise<string> {
  const dateStr = deliveryDate.toISOString().split('T')[0].replace(/-/g, '')

  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM delivery_sheets
    WHERE delivery_date = ${deliveryDate.toISOString().split('T')[0]}::date
  `)

  const count = Number(result.rows[0]?.count || 0) + 1
  return `DS-${dateStr}-${count.toString().padStart(3, '0')}`
}

/**
 * Generate delivery sheet for a specific date
 */
export async function generateDeliverySheet(
  deliveryDate: Date,
  driverName: string,
  spareInventoryKg: number,
  createdBy: string,
  notes?: string
): Promise<DeliverySheet> {
  const sheetNumber = await generateSheetNumber(deliveryDate)

  // Create delivery sheet
  const sheetResult = await db.execute(sql`
    INSERT INTO delivery_sheets (
      sheet_number,
      driver_name,
      delivery_date,
      spare_inventory_kg,
      notes,
      created_by
    )
    VALUES (
      ${sheetNumber},
      ${driverName},
      ${deliveryDate.toISOString().split('T')[0]}::date,
      ${spareInventoryKg},
      ${notes || null},
      ${createdBy}::uuid
    )
    RETURNING id, sheet_number, driver_name, delivery_date, spare_inventory_kg, notes, created_by, created_at
  `)

  const sheet = sheetResult.rows[0]
  const sheetId = sheet.id as string

  // Get all confirmed/packed orders for this delivery date
  const ordersResult = await db.execute(sql`
    SELECT
      o.id as order_id,
      o.distributor_id,
      p.full_name as distributor_name,
      oi.product_id,
      pr.name as product_name,
      oi.quantity_kg
    FROM orders o
    JOIN profiles p ON p.id = o.distributor_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products pr ON pr.id = oi.product_id
    WHERE o.status IN ('confirmed', 'packed')
    AND o.created_at::date <= ${deliveryDate.toISOString().split('T')[0]}::date
    ORDER BY p.full_name ASC, pr.name ASC
  `)

  // Get commission goods that need to be delivered
  const commissionsResult = await db.execute(sql`
    SELECT
      c.user_id as distributor_id,
      p.full_name as distributor_name,
      c.product_id,
      pr.name as product_name,
      c.product_quantity_kg
    FROM commissions c
    JOIN profiles p ON p.id = c.user_id
    JOIN products pr ON pr.id = c.product_id
    WHERE c.payment_type = 'goods'
    AND c.is_paid = FALSE
    AND c.product_id IS NOT NULL
    AND c.product_quantity_kg > 0
  `)

  const items: DeliverySheetItem[] = []

  // Add order items
  for (const row of ordersResult.rows) {
    await db.execute(sql`
      INSERT INTO delivery_sheet_items (
        delivery_sheet_id,
        distributor_id,
        product_id,
        quantity_kg,
        delivered
      )
      VALUES (
        ${sheetId}::uuid,
        ${row.distributor_id}::uuid,
        ${row.product_id}::uuid,
        ${Number(row.quantity_kg)},
        FALSE
      )
    `)

    items.push({
      distributorId: row.distributor_id as string,
      distributorName: row.distributor_name as string,
      productId: row.product_id as string,
      productName: row.product_name as string,
      quantityKg: Number(row.quantity_kg),
      isCommissionGoods: false,
      delivered: false,
    })
  }

  // Add commission goods
  for (const row of commissionsResult.rows) {
    await db.execute(sql`
      INSERT INTO delivery_sheet_items (
        delivery_sheet_id,
        distributor_id,
        product_id,
        quantity_kg,
        delivered
      )
      VALUES (
        ${sheetId}::uuid,
        ${row.distributor_id}::uuid,
        ${row.product_id}::uuid,
        ${Number(row.product_quantity_kg)},
        FALSE
      )
    `)

    items.push({
      distributorId: row.distributor_id as string,
      distributorName: row.distributor_name as string,
      productId: row.product_id as string,
      productName: row.product_name as string,
      quantityKg: Number(row.product_quantity_kg),
      isCommissionGoods: true,
      delivered: false,
    })
  }

  // Calculate total weight and volume
  const totalWeightKg = items.reduce((sum, item) => sum + item.quantityKg, 0) + spareInventoryKg
  // Estimate volume: dates have density ~1.2 kg/L, so 1 kg ≈ 0.833 L ≈ 0.000833 m³
  // Using conservative estimate: 1 kg ≈ 0.001 m³ (1 cubic meter per 1000 kg)
  const totalVolumeM3 = totalWeightKg * 0.001

  return {
    id: sheetId,
    sheetNumber: sheet.sheet_number as string,
    driverName: sheet.driver_name as string | undefined,
    deliveryDate: new Date(sheet.delivery_date as string),
    spareInventoryKg: Number(sheet.spare_inventory_kg),
    totalWeightKg,
    totalVolumeM3,
    notes: sheet.notes as string | undefined,
    items,
    createdBy: sheet.created_by as string,
    createdAt: new Date(sheet.created_at as string),
  }
}

/**
 * Get delivery sheet by ID with all items
 */
export async function getDeliverySheet(sheetId: string): Promise<DeliverySheet | null> {
  const sheetResult = await db.execute(sql`
    SELECT
      id,
      sheet_number,
      driver_name,
      delivery_date,
      spare_inventory_kg,
      notes,
      created_by,
      created_at,
      completed_at
    FROM delivery_sheets
    WHERE id = ${sheetId}::uuid
  `)

  if (sheetResult.rows.length === 0) {
    return null
  }

  const sheet = sheetResult.rows[0]

  // Get items
  const itemsResult = await db.execute(sql`
    SELECT
      dsi.distributor_id,
      p.full_name as distributor_name,
      dsi.product_id,
      pr.name as product_name,
      dsi.quantity_kg,
      dsi.delivered,
      COALESCE(
        (SELECT TRUE FROM commissions c
         WHERE c.user_id = dsi.distributor_id
         AND c.product_id = dsi.product_id
         AND c.payment_type = 'goods'
         LIMIT 1),
        FALSE
      ) as is_commission_goods
    FROM delivery_sheet_items dsi
    JOIN profiles p ON p.id = dsi.distributor_id
    JOIN products pr ON pr.id = dsi.product_id
    WHERE dsi.delivery_sheet_id = ${sheetId}::uuid
    ORDER BY p.full_name ASC, pr.name ASC
  `)

  const items: DeliverySheetItem[] = itemsResult.rows.map(row => ({
    distributorId: row.distributor_id as string,
    distributorName: row.distributor_name as string,
    productId: row.product_id as string,
    productName: row.product_name as string,
    quantityKg: Number(row.quantity_kg),
    isCommissionGoods: row.is_commission_goods as boolean,
    delivered: row.delivered as boolean,
  }))

  // Calculate totals
  const totalWeightKg = items.reduce((sum, item) => sum + item.quantityKg, 0) + Number(sheet.spare_inventory_kg)
  const totalVolumeM3 = totalWeightKg * 0.001 // 1 kg ≈ 0.001 m³

  return {
    id: sheet.id as string,
    sheetNumber: sheet.sheet_number as string,
    driverName: sheet.driver_name as string | undefined,
    deliveryDate: new Date(sheet.delivery_date as string),
    spareInventoryKg: Number(sheet.spare_inventory_kg),
    totalWeightKg,
    totalVolumeM3,
    notes: sheet.notes as string | undefined,
    items,
    createdBy: sheet.created_by as string,
    createdAt: new Date(sheet.created_at as string),
    completedAt: sheet.completed_at ? new Date(sheet.completed_at as string) : undefined,
  }
}

/**
 * Mark delivery sheet item as delivered
 */
export async function markItemDelivered(
  sheetId: string,
  distributorId: string,
  productId: string
): Promise<void> {
  await db.execute(sql`
    UPDATE delivery_sheet_items
    SET delivered = TRUE
    WHERE delivery_sheet_id = ${sheetId}::uuid
    AND distributor_id = ${distributorId}::uuid
    AND product_id = ${productId}::uuid
  `)
}

/**
 * Mark entire delivery sheet as completed
 */
export async function markSheetCompleted(sheetId: string): Promise<void> {
  await db.execute(sql`
    UPDATE delivery_sheets
    SET completed_at = NOW()
    WHERE id = ${sheetId}::uuid
  `)

  // Update related orders to 'shipped' status
  await db.execute(sql`
    UPDATE orders o
    SET status = 'shipped'
    FROM delivery_sheet_items dsi
    JOIN order_items oi ON oi.product_id = dsi.product_id AND oi.order_id = o.id
    WHERE dsi.delivery_sheet_id = ${sheetId}::uuid
    AND o.status = 'packed'
  `)
}

/**
 * Get all delivery sheets (with optional filters)
 */
export async function getDeliverySheets(
  startDate?: Date,
  endDate?: Date,
  completed?: boolean
): Promise<DeliverySheet[]> {
  let query = sql`
    SELECT
      id,
      sheet_number,
      driver_name,
      delivery_date,
      spare_inventory_kg,
      notes,
      created_by,
      created_at,
      completed_at
    FROM delivery_sheets
    WHERE TRUE
  `

  if (startDate) {
    query = sql`${query} AND delivery_date >= ${startDate.toISOString().split('T')[0]}::date`
  }

  if (endDate) {
    query = sql`${query} AND delivery_date <= ${endDate.toISOString().split('T')[0]}::date`
  }

  if (completed !== undefined) {
    if (completed) {
      query = sql`${query} AND completed_at IS NOT NULL`
    } else {
      query = sql`${query} AND completed_at IS NULL`
    }
  }

  query = sql`${query} ORDER BY delivery_date DESC, created_at DESC`

  const result = await db.execute(query)

  const sheets: DeliverySheet[] = []

  for (const row of result.rows) {
    const sheet = await getDeliverySheet(row.id as string)
    if (sheet) {
      sheets.push(sheet)
    }
  }

  return sheets
}

/**
 * Get delivery summary by distributor for a date range
 */
export async function getDeliverySummary(
  startDate: Date,
  endDate: Date
): Promise<Array<{ distributorId: string; distributorName: string; totalKg: number; deliveryCount: number }>> {
  const result = await db.execute(sql`
    SELECT
      dsi.distributor_id,
      p.full_name as distributor_name,
      SUM(dsi.quantity_kg) as total_kg,
      COUNT(DISTINCT ds.id) as delivery_count
    FROM delivery_sheet_items dsi
    JOIN delivery_sheets ds ON ds.id = dsi.delivery_sheet_id
    JOIN profiles p ON p.id = dsi.distributor_id
    WHERE ds.delivery_date >= ${startDate.toISOString().split('T')[0]}::date
    AND ds.delivery_date <= ${endDate.toISOString().split('T')[0]}::date
    GROUP BY dsi.distributor_id, p.full_name
    ORDER BY total_kg DESC
  `)

  return result.rows.map(row => ({
    distributorId: row.distributor_id as string,
    distributorName: row.distributor_name as string,
    totalKg: Number(row.total_kg),
    deliveryCount: Number(row.delivery_count),
  }))
}
