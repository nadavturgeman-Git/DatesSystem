// Database types - will be generated from Supabase
// For now, these are manual types that match our schema

export type UserRole = 'admin' | 'team_leader' | 'distributor'
export type OrderStatus = 'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'credit_card' | 'bit' | 'paybox' | 'cash'
export type CommissionType = 'distributor' | 'team_leader'
export type CommissionPaymentType = 'cash' | 'goods'
export type WarehouseType = 'freezing' | 'cooling'
export type ReturnReason = 'damaged' | 'missed_collection' | 'quality_issue' | 'other'
export type AlertType = 'low_performance' | 'spoilage_warning' | 'stock_low' | 'reservation_expired'

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone?: string
  email: string
  team_leader_id?: string
  created_at: string
  updated_at: string
}

export interface DistributorProfile {
  id: string
  user_id: string
  preferred_payment_method: PaymentMethod
  paybox_link?: string
  credit_card_last4?: string
  commission_rate: number
  prefers_commission_in_goods: boolean
  account_balance: number
  created_at: string
  updated_at: string
}

export interface Warehouse {
  id: string
  name: string
  warehouse_type: WarehouseType
  location?: string
  capacity_kg?: number
  spoilage_alert_days?: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  variety?: string
  description?: string
  price_per_kg: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Pallet {
  id: string
  pallet_id: string
  warehouse_id: string
  product_id: string
  entry_date: string
  initial_weight_kg: number
  current_weight_kg: number
  batch_number?: string
  expiry_date?: string
  is_depleted: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  distributor_id: string
  status: OrderStatus
  payment_status: PaymentStatus
  payment_method?: PaymentMethod
  total_weight_kg: number
  subtotal: number
  commission_amount: number
  total_amount: number
  notes?: string
  created_at: string
  updated_at: string
  paid_at?: string
  reservation_expires_at?: string
}

// Additional types to be added as needed
