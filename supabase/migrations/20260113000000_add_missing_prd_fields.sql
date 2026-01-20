-- Migration: Add Missing PRD v3.1 Fields
-- Date: 2026-01-13
-- Purpose: Add critical fields identified in audit report

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

-- Employment model for distributors
CREATE TYPE employment_model AS ENUM ('Credit_Commission', 'Cash_Paybox', 'Goods_Commission');

-- Delivery status for orders
CREATE TYPE delivery_status AS ENUM ('Pending', 'In_Transit', 'Delivered_to_Distributor', 'Picked_up_by_Customer');

-- Enhanced payment method enum (keeping existing values for backward compatibility)
-- Note: Existing payment_method enum already has: 'credit_card', 'bit', 'paybox', 'cash'
-- We'll use the existing enum but add logic to map to employment models

-- ============================================================================
-- ALTER TABLES: Add Missing Fields
-- ============================================================================

-- Add employment_model to distributor_profiles
ALTER TABLE distributor_profiles
ADD COLUMN IF NOT EXISTS employment_model employment_model;

-- Add preferred delivery windows (JSONB for flexibility)
ALTER TABLE distributor_profiles
ADD COLUMN IF NOT EXISTS preferred_delivery_windows JSONB DEFAULT '{"days": [], "hours": []}'::jsonb;

-- Add is_fresh_fruit to pallets
ALTER TABLE pallets
ADD COLUMN IF NOT EXISTS is_fresh_fruit BOOLEAN DEFAULT FALSE;

-- Add delivery_status to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS delivery_status delivery_status DEFAULT 'Pending';

-- Add loading_approved_at timestamp for tracking when admin approves loading
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS loading_approved_at TIMESTAMP WITH TIME ZONE;

-- Add loading_approved_by to track which admin approved
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS loading_approved_by UUID REFERENCES profiles(id);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for fresh fruit in cooling warehouses (for spoilage alerts)
CREATE INDEX IF NOT EXISTS idx_pallets_fresh_cooling 
ON pallets(warehouse_id, is_fresh_fruit, entry_date)
WHERE is_fresh_fruit = TRUE AND is_depleted = FALSE;

-- Index for delivery status queries
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status 
ON orders(delivery_status);

-- Index for employment model queries
CREATE INDEX IF NOT EXISTS idx_distributor_profiles_employment_model 
ON distributor_profiles(employment_model);

-- ============================================================================
-- UPDATE EXISTING DATA (Set defaults based on current preferences)
-- ============================================================================

-- Set employment_model based on existing preferences
-- If prefers_commission_in_goods = TRUE, set to Goods_Commission
UPDATE distributor_profiles
SET employment_model = 'Goods_Commission'
WHERE prefers_commission_in_goods = TRUE
AND employment_model IS NULL;

-- If preferred_payment_method = 'paybox' or 'cash', set to Cash_Paybox
UPDATE distributor_profiles
SET employment_model = 'Cash_Paybox'
WHERE preferred_payment_method IN ('paybox', 'cash')
AND employment_model IS NULL;

-- Default remaining to Credit_Commission
UPDATE distributor_profiles
SET employment_model = 'Credit_Commission'
WHERE employment_model IS NULL;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON COLUMN distributor_profiles.employment_model IS 'Employment model: Credit_Commission (invoice-based), Cash_Paybox (cash collection), Goods_Commission (paid in goods)';
COMMENT ON COLUMN distributor_profiles.preferred_delivery_windows IS 'JSONB: {"days": [0-6], "hours": [{"start": "HH:MM", "end": "HH:MM"}]}';
COMMENT ON COLUMN pallets.is_fresh_fruit IS 'TRUE for fresh fruit that requires cooling warehouse monitoring';
COMMENT ON COLUMN orders.delivery_status IS 'Separate from order status - tracks physical delivery progress';
COMMENT ON COLUMN orders.loading_approved_at IS 'Timestamp when admin approved order for loading (triggers physical stock decrease)';
COMMENT ON COLUMN orders.loading_approved_by IS 'Admin user who approved the loading';
