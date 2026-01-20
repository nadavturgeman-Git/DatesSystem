/**
 * Cycle-Based Commission Calculator
 *
 * Calculates commissions based on aggregated orders within a Sales Cycle,
 * rather than per-order. This ensures proper tier application based on total weight.
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { calculateDistributorRate, calculateCommissionAmount, TEAM_LEADER_RATE } from './calculator'

export interface CycleCommissionResult {
  distributorId: string
  salesCycleId: string
  totalWeightKg: number
  totalRevenue: number
  commissionRate: number
  commissionAmount: number
  paymentType: 'cash' | 'goods'
  productId?: string
  productQuantityKg?: number
  orders: string[] // Order IDs included in calculation
}

/**
 * Calculate distributor commission for a sales cycle (aggregated)
 */
export async function calculateCycleCommission(
  distributorId: string,
  salesCycleId: string
): Promise<CycleCommissionResult | null> {
  // Get sales cycle details
  const cycleResult = await db.execute(sql`
    SELECT id, start_date, end_date, minimum_order_kg
    FROM sales_cycles
    WHERE id = ${salesCycleId}::uuid
    AND is_active = TRUE
  `)

  if (cycleResult.rows.length === 0) {
    throw new Error('Sales cycle not found or inactive')
  }

  const cycle = cycleResult.rows[0]

  // Get all orders for this distributor in this cycle
  const ordersResult = await db.execute(sql`
    SELECT
      o.id,
      o.total_weight_kg,
      o.subtotal,
      o.payment_status
    FROM orders o
    WHERE o.distributor_id = ${distributorId}::uuid
    AND o.created_at >= ${cycle.start_date}::date
    AND o.created_at <= ${cycle.end_date}::date
    AND o.status NOT IN ('cancelled')
    AND o.payment_status = 'paid'
    ORDER BY o.created_at ASC
  `)

  if (ordersResult.rows.length === 0) {
    return null // No orders in this cycle
  }

  // Aggregate totals
  let totalWeightKg = 0
  let totalRevenue = 0
  const orderIds: string[] = []

  for (const order of ordersResult.rows) {
    totalWeightKg += Number(order.total_weight_kg)
    totalRevenue += Number(order.subtotal)
    orderIds.push(order.id as string)
  }

  // Get distributor profile to check preferences
  const profileResult = await db.execute(sql`
    SELECT
      prefers_commission_in_goods,
      employment_model
    FROM distributor_profiles
    WHERE user_id = ${distributorId}::uuid
  `)

  const profile = profileResult.rows[0]
  const prefersGoods = profile?.prefers_commission_in_goods as boolean || false
  const employmentModel = profile?.employment_model as string

  // Calculate commission rate based on TOTAL weight (not per order)
  const commissionRate = calculateDistributorRate(totalWeightKg)
  const commissionAmount = calculateCommissionAmount(totalRevenue, commissionRate)

  let productId: string | undefined
  let productQuantityKg: number | undefined

  // If Goods_Commission model or prefers goods, convert to product quantity
  if (prefersGoods || employmentModel === 'Goods_Commission') {
    // Get most common product from all orders in cycle
    const productResult = await db.execute(sql`
      SELECT
        oi.product_id,
        SUM(oi.quantity_kg) as total_qty
      FROM order_items oi
      WHERE oi.order_id = ANY(${orderIds}::uuid[])
      GROUP BY oi.product_id
      ORDER BY total_qty DESC
      LIMIT 1
    `)

    if (productResult.rows.length > 0) {
      productId = productResult.rows[0].product_id as string
      // Convert commission amount to kg
      const priceResult = await db.execute(sql`
        SELECT price_per_kg
        FROM products
        WHERE id = ${productId}::uuid
      `)
      const pricePerKg = Number(priceResult.rows[0]?.price_per_kg || 0)
      if (pricePerKg > 0) {
        productQuantityKg = Number((commissionAmount / pricePerKg).toFixed(2))
      }
    }
  }

  // Check if commission already exists for this cycle
  const existingResult = await db.execute(sql`
    SELECT id
    FROM commissions
    WHERE user_id = ${distributorId}::uuid
    AND commission_type = 'distributor'
    AND payment_type = ${prefersGoods ? 'goods' : 'cash'}
    AND created_at >= ${cycle.start_date}::date
    AND created_at <= ${cycle.end_date}::date
    LIMIT 1
  `)

  // Only create commission record if it doesn't exist
  if (existingResult.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO commissions (
        user_id,
        order_id, -- Use first order ID as reference
        commission_type,
        payment_type,
        base_amount,
        commission_rate,
        commission_amount,
        product_id,
        product_quantity_kg
      )
      VALUES (
        ${distributorId}::uuid,
        ${orderIds[0]}::uuid,
        'distributor',
        ${prefersGoods ? 'goods' : 'cash'},
        ${totalRevenue},
        ${commissionRate},
        ${commissionAmount},
        ${productId ? sql`${productId}::uuid` : sql`NULL`},
        ${productQuantityKg || null}
      )
    `)
  }

  return {
    distributorId,
    salesCycleId,
    totalWeightKg,
    totalRevenue,
    commissionRate,
    commissionAmount,
    paymentType: prefersGoods ? 'goods' : 'cash',
    productId,
    productQuantityKg,
    orders: orderIds,
  }
}

/**
 * Calculate team leader commission for a sales cycle
 * 5% of gross sales from all distributors in their region
 */
export async function calculateTeamLeaderCycleCommission(
  teamLeaderId: string,
  salesCycleId: string
): Promise<CycleCommissionResult | null> {
  // Get sales cycle details
  const cycleResult = await db.execute(sql`
    SELECT id, start_date, end_date
    FROM sales_cycles
    WHERE id = ${salesCycleId}::uuid
    AND is_active = TRUE
  `)

  if (cycleResult.rows.length === 0) {
    throw new Error('Sales cycle not found or inactive')
  }

  const cycle = cycleResult.rows[0]

  // Get all distributors assigned to this team leader
  const distributorsResult = await db.execute(sql`
    SELECT id
    FROM profiles
    WHERE team_leader_id = ${teamLeaderId}::uuid
    AND role = 'distributor'
  `)

  if (distributorsResult.rows.length === 0) {
    return null // No distributors assigned
  }

  const distributorIds = distributorsResult.rows.map(r => r.id as string)

  // Get all orders from these distributors in this cycle
  const ordersResult = await db.execute(sql`
    SELECT
      o.id,
      o.subtotal,
      o.payment_status
    FROM orders o
    WHERE o.distributor_id = ANY(${distributorIds}::uuid[])
    AND o.created_at >= ${cycle.start_date}::date
    AND o.created_at <= ${cycle.end_date}::date
    AND o.status NOT IN ('cancelled')
    AND o.payment_status = 'paid'
  `)

  if (ordersResult.rows.length === 0) {
    return null
  }

  // Aggregate total revenue
  let totalRevenue = 0
  const orderIds: string[] = []

  for (const order of ordersResult.rows) {
    totalRevenue += Number(order.subtotal)
    orderIds.push(order.id as string)
  }

  // Calculate 5% commission
  const commissionAmount = calculateCommissionAmount(totalRevenue, TEAM_LEADER_RATE)

  // Check if commission already exists
  const existingResult = await db.execute(sql`
    SELECT id
    FROM commissions
    WHERE user_id = ${teamLeaderId}::uuid
    AND commission_type = 'team_leader'
    AND created_at >= ${cycle.start_date}::date
    AND created_at <= ${cycle.end_date}::date
    LIMIT 1
  `)

  if (existingResult.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO commissions (
        user_id,
        order_id,
        commission_type,
        payment_type,
        base_amount,
        commission_rate,
        commission_amount
      )
      VALUES (
        ${teamLeaderId}::uuid,
        ${orderIds[0]}::uuid,
        'team_leader',
        'cash',
        ${totalRevenue},
        ${TEAM_LEADER_RATE},
        ${commissionAmount}
      )
    `)
  }

  return {
    distributorId: teamLeaderId,
    salesCycleId,
    totalWeightKg: 0, // Not applicable for team leader
    totalRevenue,
    commissionRate: TEAM_LEADER_RATE,
    commissionAmount,
    paymentType: 'cash',
    orders: orderIds,
  }
}

/**
 * Calculate commissions for all distributors in a sales cycle
 */
export async function calculateAllCycleCommissions(
  salesCycleId: string
): Promise<{
  distributorCommissions: CycleCommissionResult[]
  teamLeaderCommissions: CycleCommissionResult[]
}> {
  // Get all distributors
  const distributorsResult = await db.execute(sql`
    SELECT id
    FROM profiles
    WHERE role = 'distributor'
  `)

  const distributorCommissions: CycleCommissionResult[] = []

  for (const distributor of distributorsResult.rows) {
    try {
      const commission = await calculateCycleCommission(
        distributor.id as string,
        salesCycleId
      )
      if (commission) {
        distributorCommissions.push(commission)
      }
    } catch (error) {
      console.error(`Error calculating commission for distributor ${distributor.id}:`, error)
    }
  }

  // Get all team leaders
  const teamLeadersResult = await db.execute(sql`
    SELECT DISTINCT team_leader_id
    FROM profiles
    WHERE team_leader_id IS NOT NULL
    AND role = 'distributor'
  `)

  const teamLeaderCommissions: CycleCommissionResult[] = []

  for (const teamLeader of teamLeadersResult.rows) {
    try {
      const commission = await calculateTeamLeaderCycleCommission(
        teamLeader.team_leader_id as string,
        salesCycleId
      )
      if (commission) {
        teamLeaderCommissions.push(commission)
      }
    } catch (error) {
      console.error(`Error calculating commission for team leader ${teamLeader.team_leader_id}:`, error)
    }
  }

  return {
    distributorCommissions,
    teamLeaderCommissions,
  }
}
