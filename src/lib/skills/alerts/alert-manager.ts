/**
 * Alert Manager Skill
 *
 * Implements system-wide alert generation and management.
 *
 * Key Features:
 * - 50kg Rule: Alert when distributors underperform
 * - Spoilage Warnings: Alert when cooling warehouse items exceed duration
 * - Low Stock Alerts: Notify when inventory is low
 * - Custom alerts for various events
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

// Helper function to normalize Drizzle results
function getRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result?.rows && Array.isArray(result.rows)) return result.rows;
  return [];
}

export type AlertType = 'low_performance' | 'spoilage_warning' | 'stock_low' | 'reservation_expired'

export interface Alert {
  id: string
  type: AlertType
  targetUserId?: string
  title: string
  message: string
  metadata?: Record<string, any>
  isRead: boolean
  isResolved: boolean
  createdAt: Date
}

/**
 * Create a new alert
 */
export async function createAlert(
  type: AlertType,
  title: string,
  message: string,
  targetUserId?: string,
  metadata?: Record<string, any>
): Promise<Alert> {
  const result = await db.execute(sql`
    INSERT INTO alerts (alert_type, target_user_id, title, message, metadata)
    VALUES (
      ${type},
      ${targetUserId ? sql`${targetUserId}::uuid` : sql`NULL`},
      ${title},
      ${message},
      ${metadata ? sql`${JSON.stringify(metadata)}::jsonb` : sql`NULL`}
    )
    RETURNING id, alert_type, target_user_id, title, message, metadata, is_read, is_resolved, created_at
  `)

  const rows = getRows(result)
  const row = rows[0]
  return {
    id: row.id as string,
    type: row.alert_type as AlertType,
    targetUserId: row.target_user_id as string | undefined,
    title: row.title as string,
    message: row.message as string,
    metadata: row.metadata as Record<string, any> | undefined,
    isRead: row.is_read as boolean,
    isResolved: row.is_resolved as boolean,
    createdAt: new Date(row.created_at as string),
  }
}

/**
 * Check and create 50kg rule alerts for underperforming distributors
 */
export async function check50kgRule(salesCycleId: string): Promise<Alert[]> {
  // Get sales cycle details
  const cycleResult = await db.execute(sql`
    SELECT start_date, end_date, minimum_order_kg
    FROM sales_cycles
    WHERE id = ${salesCycleId}::uuid
  `)

  const cycleRows = getRows(cycleResult)
  if (cycleRows.length === 0) {
    throw new Error('Sales cycle not found')
  }

  const cycle = cycleRows[0]
  const minimumKg = Number(cycle.minimum_order_kg || 50)

  // Get distributors who didn't meet minimum
  const underperformersResult = await db.execute(sql`
    SELECT
      p.id as distributor_id,
      p.full_name,
      COALESCE(SUM(o.total_weight_kg), 0) as total_weight,
      COUNT(o.id) as order_count
    FROM profiles p
    LEFT JOIN orders o ON o.distributor_id = p.id
      AND o.created_at >= ${cycle.start_date}::date
      AND o.created_at <= ${cycle.end_date}::date
      AND o.status IN ('confirmed', 'packed', 'shipped', 'delivered')
    WHERE p.role = 'distributor'
    GROUP BY p.id, p.full_name
    HAVING COALESCE(SUM(o.total_weight_kg), 0) < ${minimumKg}
  `)

  const alerts: Alert[] = []

  for (const row of getRows(underperformersResult)) {
    const totalWeight = Number(row.total_weight)
    const shortfall = minimumKg - totalWeight

    const alert = await createAlert(
      'low_performance',
      `נקודת חלוקה לא עמדה במינימום - ${row.full_name}`,
      `נקודת החלוקה הזמינה רק ${totalWeight}ק"ג במחזור המכירות הנוכחי. מינימום נדרש: ${minimumKg}ק"ג. חוסר: ${shortfall}ק"ג.`,
      row.distributor_id as string,
      {
        salesCycleId,
        distributorId: row.distributor_id,
        totalWeight,
        minimumKg,
        shortfall,
        orderCount: Number(row.order_count),
      }
    )

    alerts.push(alert)

    // Update performance metrics
    await db.execute(sql`
      INSERT INTO performance_metrics (
        distributor_id,
        sales_cycle_start,
        sales_cycle_end,
        total_weight_kg,
        total_orders,
        met_minimum_threshold
      )
      VALUES (
        ${row.distributor_id}::uuid,
        ${cycle.start_date}::date,
        ${cycle.end_date}::date,
        ${totalWeight},
        ${Number(row.order_count)},
        FALSE
      )
      ON CONFLICT (distributor_id, sales_cycle_start)
      DO UPDATE SET
        total_weight_kg = ${totalWeight},
        total_orders = ${Number(row.order_count)},
        met_minimum_threshold = FALSE,
        updated_at = NOW()
    `)
  }

  return alerts
}

/**
 * Check and create spoilage warnings for cooling warehouse items
 */
export async function checkSpoilageAlerts(): Promise<Alert[]> {
  // Get cooling warehouses with alert configuration
  const warehousesResult = await db.execute(sql`
    SELECT id, name, spoilage_alert_days
    FROM warehouses
    WHERE warehouse_type = 'cooling'
    AND is_active = TRUE
    AND spoilage_alert_days IS NOT NULL
  `)

  const alerts: Alert[] = []

  for (const warehouse of getRows(warehousesResult)) {
    const alertDays = Number(warehouse.spoilage_alert_days)

    // Find pallets that exceed storage duration
    // PRD requirement: Check for fresh fruit in Jerusalem warehouse specifically
    const palletsResult = await db.execute(sql`
      SELECT
        p.id,
        p.pallet_id,
        p.entry_date,
        p.current_weight_kg,
        p.is_fresh_fruit,
        pr.name as product_name,
        EXTRACT(DAY FROM (NOW() - p.entry_date)) as days_stored
      FROM pallets p
      JOIN products pr ON pr.id = p.product_id
      WHERE p.warehouse_id = ${warehouse.id}::uuid
      AND p.is_depleted = FALSE
      AND p.is_fresh_fruit = TRUE
      AND p.entry_date < NOW() - (${alertDays} || ' days')::interval
    `)

    for (const pallet of getRows(palletsResult)) {
      const daysStored = Math.floor(Number(pallet.days_stored))

      const alert = await createAlert(
        'spoilage_warning',
        `אזהרת קירור - ${pallet.product_name}`,
        `משטח ${pallet.pallet_id} נמצא בקירור ${daysStored} ימים (סף: ${alertDays} ימים). משקל: ${pallet.current_weight_kg}ק"ג. מחסן: ${warehouse.name}`,
        undefined, // Send to admin/all
        {
          warehouseId: warehouse.id,
          palletId: pallet.id,
          palletIdReadable: pallet.pallet_id,
          productName: pallet.product_name,
          daysStored,
          alertThreshold: alertDays,
          currentWeight: Number(pallet.current_weight_kg),
        }
      )

      alerts.push(alert)
    }
  }

  return alerts
}

/**
 * Check and create low stock alerts
 */
export async function checkLowStockAlerts(thresholdKg: number = 100): Promise<Alert[]> {
  const result = await db.execute(sql`
    SELECT
      pr.id,
      pr.name,
      pr.variety,
      SUM(p.current_weight_kg) as total_stock
    FROM products pr
    JOIN pallets p ON p.product_id = pr.id
    WHERE p.is_depleted = FALSE
    AND pr.is_active = TRUE
    GROUP BY pr.id, pr.name, pr.variety
    HAVING SUM(p.current_weight_kg) < ${thresholdKg}
  `)

  const alerts: Alert[] = []

  for (const row of getRows(result)) {
    const totalStock = Number(row.total_stock)

    const alert = await createAlert(
      'stock_low',
      `מלאי נמוך - ${row.name}`,
      `מלאי ${row.name} ${row.variety ? `(${row.variety})` : ''} ירד ל-${totalStock}ק"ג. סף התראה: ${thresholdKg}ק"ג.`,
      undefined, // Send to admin
      {
        productId: row.id,
        productName: row.name,
        variety: row.variety,
        currentStock: totalStock,
        threshold: thresholdKg,
      }
    )

    alerts.push(alert)
  }

  return alerts
}

/**
 * Mark alert as read
 */
export async function markAlertRead(alertId: string): Promise<void> {
  await db.execute(sql`
    UPDATE alerts
    SET is_read = TRUE
    WHERE id = ${alertId}::uuid
  `)
}

/**
 * Mark alert as resolved
 */
export async function markAlertResolved(alertId: string): Promise<void> {
  await db.execute(sql`
    UPDATE alerts
    SET is_resolved = TRUE, resolved_at = NOW()
    WHERE id = ${alertId}::uuid
  `)
}

/**
 * Get unread alerts for a user (or all if no userId)
 */
export async function getUnreadAlerts(userId?: string): Promise<Alert[]> {
  const result = await db.execute(sql`
    SELECT id, alert_type, target_user_id, title, message, metadata, is_read, is_resolved, created_at
    FROM alerts
    WHERE is_read = FALSE
    AND is_resolved = FALSE
    ${userId ? sql`AND (target_user_id = ${userId}::uuid OR target_user_id IS NULL)` : sql``}
    ORDER BY created_at DESC
  `)

  return getRows(result).map(row => ({
    id: row.id as string,
    type: row.alert_type as AlertType,
    targetUserId: row.target_user_id as string | undefined,
    title: row.title as string,
    message: row.message as string,
    metadata: row.metadata as Record<string, any> | undefined,
    isRead: row.is_read as boolean,
    isResolved: row.is_resolved as boolean,
    createdAt: new Date(row.created_at as string),
  }))
}

/**
 * Run all alert checks (should be called periodically - cron job)
 */
export async function runAllAlertChecks(salesCycleId?: string): Promise<{
  fiftyKgAlerts: Alert[]
  spoilageAlerts: Alert[]
  lowStockAlerts: Alert[]
}> {
  const spoilageAlerts = await checkSpoilageAlerts()
  const lowStockAlerts = await checkLowStockAlerts()

  let fiftyKgAlerts: Alert[] = []
  if (salesCycleId) {
    fiftyKgAlerts = await check50kgRule(salesCycleId)
  }

  return {
    fiftyKgAlerts,
    spoilageAlerts,
    lowStockAlerts,
  }
}
