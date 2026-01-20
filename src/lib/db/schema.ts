import { pgTable, uuid, varchar, text, decimal, boolean, timestamp, date, integer, pgEnum, index, unique } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================================
// ENUMS
// ============================================================================

export const userRoleEnum = pgEnum('user_role', ['admin', 'team_leader', 'distributor'])
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'])
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'paid', 'failed', 'refunded'])
export const paymentMethodEnum = pgEnum('payment_method', ['credit_card', 'bit', 'paybox', 'cash'])
export const commissionTypeEnum = pgEnum('commission_type', ['distributor', 'team_leader'])
export const commissionPaymentTypeEnum = pgEnum('commission_payment_type', ['cash', 'goods'])
export const warehouseTypeEnum = pgEnum('warehouse_type', ['freezing', 'cooling'])
export const returnReasonEnum = pgEnum('return_reason', ['damaged', 'missed_collection', 'quality_issue', 'other'])
export const alertTypeEnum = pgEnum('alert_type', ['low_performance', 'spoilage_warning', 'stock_low', 'reservation_expired'])

// ============================================================================
// TABLES
// ============================================================================

// Note: This schema will be used alongside the Supabase SQL schema
// We keep this for TypeScript type safety and Drizzle ORM queries
// The actual tables are managed by supabase-schema.sql

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  role: userRoleEnum('role').notNull().default('distributor'),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }).notNull(),
  teamLeaderId: uuid('team_leader_id'), // Self-reference handled via relations
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const distributorProfiles = pgTable('distributor_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  preferredPaymentMethod: paymentMethodEnum('preferred_payment_method').notNull().default('cash'),
  payboxLink: varchar('paybox_link', { length: 500 }),
  creditCardLast4: varchar('credit_card_last4', { length: 4 }),
  commissionRate: decimal('commission_rate', { precision: 5, scale: 2 }).default('15.00'),
  prefersCommissionInGoods: boolean('prefers_commission_in_goods').default(false),
  accountBalance: decimal('account_balance', { precision: 12, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdUnique: unique().on(table.userId),
}))

export const warehouses = pgTable('warehouses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  warehouseType: warehouseTypeEnum('warehouse_type').notNull(),
  location: varchar('location', { length: 500 }),
  capacityKg: decimal('capacity_kg', { precision: 12, scale: 2 }),
  spoilageAlertDays: integer('spoilage_alert_days'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  variety: varchar('variety', { length: 100 }),
  description: text('description'),
  pricePerKg: decimal('price_per_kg', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// Additional tables will be added as needed
// For now, this provides type safety for the core entities

// ============================================================================
// PLACEHOLDER - More tables to be added:
// - pallets
// - orders
// - order_items
// - pallet_allocations
// - stock_reservations
// - commissions
// - returns
// - delivery_sheets
// - delivery_sheet_items
// - alerts
// - performance_metrics
// ============================================================================
