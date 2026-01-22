/**
 * Commission Calculator Skill
 *
 * Implements dynamic commission engine with tiered rates and goods conversion.
 *
 * Key Features:
 * - Tiered distributor commissions (15%, 17%, 20% based on weight)
 * - Team leader flat 5% commission
 * - Commission-in-goods conversion
 * - Automatic calculation on order completion
 */

import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'

export interface CommissionTier {
  minWeight: number
  maxWeight: number | null
  rate: number
}

// Commission tiers as per PRD
export const DISTRIBUTOR_TIERS: CommissionTier[] = [
  { minWeight: 0, maxWeight: 50, rate: 15 },
  { minWeight: 50, maxWeight: 75, rate: 17 },
  { minWeight: 75, maxWeight: null, rate: 20 },
]

export const TEAM_LEADER_RATE = 5

export interface CommissionCalculation {
  userId: string
  orderId: string
  commissionType: 'distributor' | 'team_leader'
  baseAmount: number
  rate: number
  commissionAmount: number
  paymentType: 'cash' | 'goods'
  productId?: string
  productQuantityKg?: number
}

/**
 * Calculate distributor commission rate based on order weight
 */
export function calculateDistributorRate(weightKg: number): number {
  for (const tier of DISTRIBUTOR_TIERS) {
    if (tier.maxWeight === null) {
      if (weightKg >= tier.minWeight) {
        return tier.rate
      }
    } else {
      if (weightKg >= tier.minWeight && weightKg < tier.maxWeight) {
        return tier.rate
      }
    }
  }
  return DISTRIBUTOR_TIERS[0].rate // Default to lowest tier
}

/**
 * Calculate commission amount
 */
export function calculateCommissionAmount(
  baseAmount: number,
  rate: number
): number {
  return Number((baseAmount * (rate / 100)).toFixed(2))
}

/**
 * Convert commission amount to product quantity
 */
export async function convertCommissionToGoods(
  commissionAmount: number,
  productId: string
): Promise<number> {
  // Get product price per kg
  const result = await db.execute(sql`
    SELECT price_per_kg
    FROM products
    WHERE id = ${productId}::uuid
  `)

  if (result.rows.length === 0) {
    throw new Error('Product not found')
  }

  const pricePerKg = Number(result.rows[0].price_per_kg)
  return Number((commissionAmount / pricePerKg).toFixed(2))
}

/**
 * Calculate and create distributor commission for an order
 */
export async function calculateDistributorCommission(
  orderId: string
): Promise<CommissionCalculation> {
  // Get order details
  const orderResult = await db.execute(sql`
    SELECT
      o.id,
      o.distributor_id,
      o.total_weight_kg,
      o.subtotal,
      dp.prefers_commission_in_goods,
      dp.commission_rate as custom_rate
    FROM orders o
    JOIN distributor_profiles dp ON dp.user_id = o.distributor_id
    WHERE o.id = ${orderId}::uuid
  `)

  if (orderResult.rows.length === 0) {
    throw new Error('Order not found')
  }

  const order = orderResult.rows[0]
  const weightKg = Number(order.total_weight_kg)
  const subtotal = Number(order.subtotal)
  const prefersGoods = order.prefers_commission_in_goods as boolean

  // Use custom rate if set, otherwise calculate from tiers
  const rate = order.custom_rate
    ? Number(order.custom_rate)
    : calculateDistributorRate(weightKg)

  const commissionAmount = calculateCommissionAmount(subtotal, rate)

  let productId: string | undefined
  let productQuantityKg: number | undefined

  if (prefersGoods) {
    // Get the most common product from order items
    const productResult = await db.execute(sql`
      SELECT product_id, SUM(quantity_kg) as total_qty
      FROM order_items
      WHERE order_id = ${orderId}::uuid
      GROUP BY product_id
      ORDER BY total_qty DESC
      LIMIT 1
    `)

    if (productResult.rows.length > 0) {
      productId = productResult.rows[0].product_id as string
      productQuantityKg = await convertCommissionToGoods(commissionAmount, productId)
    }
  }

  // Get distributor profile to check if Group Discount
  const distributorProfileResult = await db.execute(sql`
    SELECT is_group_discount
    FROM distributor_profiles
    WHERE user_id = ${order.distributor_id}::uuid
  `)
  const isGroupDiscount = distributorProfileResult.rows[0]?.is_group_discount || false

  // Insert or update commission record (idempotent - safe to call multiple times)
  await db.execute(sql`
    INSERT INTO commissions (
      user_id,
      order_id,
      commission_type,
      payment_type,
      settlement_type,
      base_amount,
      commission_rate,
      commission_amount,
      product_id,
      product_quantity_kg
    )
    VALUES (
      ${order.distributor_id}::uuid,
      ${orderId}::uuid,
      'distributor',
      ${prefersGoods ? 'goods' : 'cash'},
      ${isGroupDiscount ? 'group_discount' : 'invoice_payslip'},
      ${subtotal},
      ${rate},
      ${commissionAmount},
      ${productId ? sql`${productId}::uuid` : sql`NULL`},
      ${productQuantityKg || null}
    )
    ON CONFLICT (order_id, user_id, commission_type)
    DO UPDATE SET
      payment_type = EXCLUDED.payment_type,
      settlement_type = EXCLUDED.settlement_type,
      base_amount = EXCLUDED.base_amount,
      commission_rate = EXCLUDED.commission_rate,
      commission_amount = EXCLUDED.commission_amount,
      product_id = EXCLUDED.product_id,
      product_quantity_kg = EXCLUDED.product_quantity_kg
  `)

  return {
    userId: order.distributor_id as string,
    orderId: orderId,
    commissionType: 'distributor',
    baseAmount: subtotal,
    rate,
    commissionAmount,
    paymentType: prefersGoods ? 'goods' : 'cash',
    productId,
    productQuantityKg,
  }
}

/**
 * Calculate and create team leader commission for an order
 */
export async function calculateTeamLeaderCommission(
  orderId: string
): Promise<CommissionCalculation | null> {
  // Get distributor's team leader
  const result = await db.execute(sql`
    SELECT
      o.id,
      o.distributor_id,
      o.subtotal,
      p.team_leader_id
    FROM orders o
    JOIN profiles p ON p.id = o.distributor_id
    WHERE o.id = ${orderId}::uuid
    AND p.team_leader_id IS NOT NULL
  `)

  if (result.rows.length === 0 || !result.rows[0].team_leader_id) {
    return null // No team leader for this distributor
  }

  const order = result.rows[0]
  const subtotal = Number(order.subtotal)
  const teamLeaderId = order.team_leader_id as string

  const commissionAmount = calculateCommissionAmount(subtotal, TEAM_LEADER_RATE)

  // Insert or update commission record (idempotent - safe to call multiple times)
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
      ${orderId}::uuid,
      'team_leader',
      'cash',
      ${subtotal},
      ${TEAM_LEADER_RATE},
      ${commissionAmount}
    )
    ON CONFLICT (order_id, user_id, commission_type)
    DO UPDATE SET
      payment_type = EXCLUDED.payment_type,
      base_amount = EXCLUDED.base_amount,
      commission_rate = EXCLUDED.commission_rate,
      commission_amount = EXCLUDED.commission_amount
  `)

  return {
    userId: teamLeaderId,
    orderId: orderId,
    commissionType: 'team_leader',
    baseAmount: subtotal,
    rate: TEAM_LEADER_RATE,
    commissionAmount,
    paymentType: 'cash',
  }
}

/**
 * Calculate all commissions for an order (distributor + team leader)
 */
export async function calculateOrderCommissions(
  orderId: string
): Promise<{ distributor: CommissionCalculation; teamLeader: CommissionCalculation | null }> {
  const distributor = await calculateDistributorCommission(orderId)
  const teamLeader = await calculateTeamLeaderCommission(orderId)

  // Update order with commission amount
  const totalCommission = distributor.commissionAmount + (teamLeader?.commissionAmount || 0)

  await db.execute(sql`
    UPDATE orders
    SET commission_amount = ${totalCommission}
    WHERE id = ${orderId}::uuid
  `)

  return {
    distributor,
    teamLeader,
  }
}

/**
 * Get unpaid commissions for a user
 */
export async function getUnpaidCommissions(userId: string): Promise<CommissionCalculation[]> {
  const result = await db.execute(sql`
    SELECT
      user_id,
      order_id,
      commission_type,
      payment_type,
      base_amount,
      commission_rate,
      commission_amount,
      product_id,
      product_quantity_kg,
      created_at
    FROM commissions
    WHERE user_id = ${userId}::uuid
    AND is_paid = FALSE
    ORDER BY created_at DESC
  `)

  return result.rows.map(row => ({
    userId: row.user_id as string,
    orderId: row.order_id as string,
    commissionType: row.commission_type as 'distributor' | 'team_leader',
    baseAmount: Number(row.base_amount),
    rate: Number(row.commission_rate),
    commissionAmount: Number(row.commission_amount),
    paymentType: row.payment_type as 'cash' | 'goods',
    productId: row.product_id as string | undefined,
    productQuantityKg: row.product_quantity_kg ? Number(row.product_quantity_kg) : undefined,
  }))
}

/**
 * Mark commission as paid
 */
export async function markCommissionPaid(orderId: string, userId: string): Promise<void> {
  await db.execute(sql`
    UPDATE commissions
    SET is_paid = TRUE, paid_at = NOW()
    WHERE order_id = ${orderId}::uuid
    AND user_id = ${userId}::uuid
  `)
}

/**
 * Get commission summary for a user (total earned, paid, unpaid)
 */
export async function getCommissionSummary(userId: string): Promise<{
  totalEarned: number
  totalPaid: number
  totalUnpaid: number
  unpaidCount: number
}> {
  const result = await db.execute(sql`
    SELECT
      SUM(commission_amount) as total_earned,
      SUM(CASE WHEN is_paid THEN commission_amount ELSE 0 END) as total_paid,
      SUM(CASE WHEN NOT is_paid THEN commission_amount ELSE 0 END) as total_unpaid,
      COUNT(CASE WHEN NOT is_paid THEN 1 END) as unpaid_count
    FROM commissions
    WHERE user_id = ${userId}::uuid
  `)

  const row = result.rows[0]

  return {
    totalEarned: Number(row.total_earned || 0),
    totalPaid: Number(row.total_paid || 0),
    totalUnpaid: Number(row.total_unpaid || 0),
    unpaidCount: Number(row.unpaid_count || 0),
  }
}
