-- Migration: Update Employment Model ENUM to 4 Settlement Profiles
-- Date: 2026-01-18
-- Purpose: Split Credit_Commission into Payslip and Private_Business for accounting/tax clarity
-- PRD Requirement: 4 distinct settlement profiles for distributor onboarding

-- ============================================================================
-- ADD NEW ENUM VALUES
-- ============================================================================

-- Add Payslip (תלוש) - for salaried employees who receive payslips
ALTER TYPE employment_model ADD VALUE IF NOT EXISTS 'Payslip';

-- Add Private_Business (עסק) - for independent business owners
ALTER TYPE employment_model ADD VALUE IF NOT EXISTS 'Private_Business';

-- Existing values: Cash_Paybox, Goods_Commission (no changes needed)

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON TYPE employment_model IS
'4 settlement profiles for distributors:
- Payslip (תלוש): Salaried employee model with payslip generation
- Private_Business (עסק): Independent business owner with invoice requirements
- Cash_Paybox: Cash collection or Paybox link payment model
- Goods_Commission (סחורה): Commission paid in goods/products';

COMMENT ON COLUMN distributor_profiles.employment_model IS
'Settlement profile type:
- Payslip: Employee model (requires payslip generation)
- Private_Business: Business owner model (requires invoices)
- Cash_Paybox: Cash or Paybox payment
- Goods_Commission: Paid in products';

-- ============================================================================
-- MIGRATE EXISTING DATA (Optional - Update Credit_Commission to Payslip)
-- ============================================================================

-- If you have existing records with Credit_Commission, update them to Payslip
-- This assumes Credit_Commission was being used for the payslip model
-- Skip this if you want to keep Credit_Commission records as-is

-- UPDATE distributor_profiles
-- SET employment_model = 'Payslip'
-- WHERE employment_model = 'Credit_Commission';

-- Note: The above is commented out. Un-comment if you want to migrate existing data.

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all enum values
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = 'employment_model'::regtype
ORDER BY enumsortorder;

-- Count distributors by employment model
SELECT
    employment_model,
    COUNT(*) as count
FROM distributor_profiles
WHERE employment_model IS NOT NULL
GROUP BY employment_model
ORDER BY count DESC;
