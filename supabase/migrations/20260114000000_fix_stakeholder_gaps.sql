-- Migration: Fix Stakeholder Gaps
-- Date: 2026-01-14
-- Purpose: Add missing fields identified in stakeholder verification audit

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

-- Settlement type for commissions (Group Discount vs Invoice/Payslip)
DO $$ BEGIN
    CREATE TYPE commission_settlement_type AS ENUM ('invoice_payslip', 'group_discount');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- ALTER TABLES: Add Missing Fields
-- ============================================================================

-- Add is_fresh_fruit to pallets (if not already exists from previous migration)
ALTER TABLE pallets
ADD COLUMN IF NOT EXISTS is_fresh_fruit BOOLEAN DEFAULT FALSE;

-- Add is_group_discount to distributor_profiles
ALTER TABLE distributor_profiles
ADD COLUMN IF NOT EXISTS is_group_discount BOOLEAN DEFAULT FALSE;

-- Add settlement_type to commissions
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS settlement_type commission_settlement_type DEFAULT 'invoice_payslip';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for fresh fruit in cooling warehouses (for spoilage alerts)
CREATE INDEX IF NOT EXISTS idx_pallets_fresh_cooling 
ON pallets(warehouse_id, is_fresh_fruit, entry_date)
WHERE is_fresh_fruit = TRUE AND is_depleted = FALSE;

-- Index for group discount queries
CREATE INDEX IF NOT EXISTS idx_distributor_profiles_group_discount 
ON distributor_profiles(is_group_discount);

-- Index for settlement type queries
CREATE INDEX IF NOT EXISTS idx_commissions_settlement_type 
ON commissions(settlement_type);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON COLUMN pallets.is_fresh_fruit IS 'TRUE for fresh fruit that requires cooling warehouse monitoring (Jerusalem warehouse)';
COMMENT ON COLUMN distributor_profiles.is_group_discount IS 'TRUE for Group Discount distributors (הנחה קבוצתית), FALSE for Invoice/Payslip distributors';
COMMENT ON COLUMN commissions.settlement_type IS 'invoice_payslip: Commission handled via invoice/payslip, group_discount: Commission handled as discount on final balance';
