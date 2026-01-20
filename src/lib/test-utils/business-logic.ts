/**
 * Pure business logic functions for unit testing
 * These functions contain the core business logic without database dependencies
 */

import { calculateDistributorRate, calculateCommissionAmount, TEAM_LEADER_RATE } from '../skills/commissions/calculator'

// ============================================================================
// Commission Logic (Pure Functions)
// ============================================================================

export interface Order {
  weight: number
  price?: number // Optional price per kg, defaults to 1
}

export interface CycleCommissionResult {
  tier: number // Commission rate as decimal (0.15, 0.17, 0.20)
  amount: number // Commission amount
  totalWeight: number
  totalRevenue: number
}

/**
 * Calculate cycle commission for a set of orders (pure function)
 * This is a test-friendly version that works with mock order data
 */
export function calculateCycleCommission(orders: Order[]): CycleCommissionResult {
  // Calculate total weight
  const totalWeight = orders.reduce((sum, order) => sum + order.weight, 0)
  
  // Calculate total revenue (default price is 1 per kg if not specified)
  const totalRevenue = orders.reduce((sum, order) => {
    const price = order.price || 1
    return sum + (order.weight * price)
  }, 0)
  
  // Get commission rate based on total weight (as percentage)
  const ratePercent = calculateDistributorRate(totalWeight)
  
  // Convert to decimal for tier comparison
  const tier = ratePercent / 100
  
  // Calculate commission amount
  const amount = calculateCommissionAmount(totalRevenue, ratePercent)
  
  return {
    tier,
    amount,
    totalWeight,
    totalRevenue,
  }
}

/**
 * Calculate team leader commission (5% of regional sales)
 */
export function calculateTeamLeaderCommission(regionalSales: number): number {
  return calculateCommissionAmount(regionalSales, TEAM_LEADER_RATE)
}

// ============================================================================
// FIFO Inventory Logic (Pure Functions)
// ============================================================================

export interface MockPallet {
  id: string
  entry_date: string | Date
  weight: number
  reserved?: number // Reserved weight (defaults to 0)
}

export interface FIFOAllocation {
  pallet_id: string
  allocated_weight: number
  remaining_weight: number
}

/**
 * Allocate inventory using FIFO methodology (pure function)
 * This is a test-friendly version that works with mock pallet data
 */
export function allocateFIFOInventory(
  pallets: MockPallet[],
  requestedWeight: number
): FIFOAllocation[] {
  // Sort pallets by entry_date (oldest first)
  const sortedPallets = [...pallets].sort((a, b) => {
    const dateA = typeof a.entry_date === 'string' ? new Date(a.entry_date) : a.entry_date
    const dateB = typeof b.entry_date === 'string' ? new Date(b.entry_date) : b.entry_date
    return dateA.getTime() - dateB.getTime()
  })
  
  const allocations: FIFOAllocation[] = []
  let remainingToAllocate = requestedWeight
  
  for (const pallet of sortedPallets) {
    if (remainingToAllocate <= 0) break
    
    const reserved = pallet.reserved || 0
    const availableInPallet = pallet.weight - reserved
    
    if (availableInPallet <= 0) continue
    
    const toAllocate = Math.min(availableInPallet, remainingToAllocate)
    
    allocations.push({
      pallet_id: pallet.id,
      allocated_weight: toAllocate,
      remaining_weight: availableInPallet - toAllocate,
    })
    
    remainingToAllocate -= toAllocate
  }
  
  return allocations
}

// ============================================================================
// Stock Management Logic (Pure Functions)
// ============================================================================

export interface StockState {
  physical: number
  reserved: number
}

/**
 * Create an order (reserve stock without decreasing physical inventory)
 */
export function createOrder(stock: StockState, requestedWeight: number): StockState {
  return {
    physical: stock.physical, // Physical stock remains unchanged
    reserved: stock.reserved + requestedWeight, // Reserved stock increases
  }
}

/**
 * Approve loading (decrease physical stock, clear reservations)
 */
export function approveLoading(stock: StockState): StockState {
  return {
    physical: stock.physical - stock.reserved, // Physical stock decreases by reserved amount
    reserved: 0, // Reservations are cleared
  }
}

// ============================================================================
// Payment Logic (Pure Functions)
// ============================================================================

export interface Distributor {
  model: 'Cash_Paybox' | 'Credit_Commission' | 'Goods_Commission'
  paybox_link?: string
}

export interface PaymentDetails {
  showPaybox: boolean
  link?: string
}

/**
 * Get payment details for a distributor
 * Only Cash_Paybox distributors get Paybox links
 */
export function getPaymentDetails(distributor: Distributor): PaymentDetails {
  if (distributor.model === 'Cash_Paybox' && distributor.paybox_link) {
    return {
      showPaybox: true,
      link: distributor.paybox_link,
    }
  }
  
  return {
    showPaybox: false,
  }
}
