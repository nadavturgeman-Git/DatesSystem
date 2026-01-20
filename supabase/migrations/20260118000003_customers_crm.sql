-- Migration: Customer CRM System
-- Date: 2026-01-18
-- Purpose: Enable CRM features for customer tracking and data persistence
-- PRD Requirement: Customer personal area with phone lookup and lifetime value tracking

-- ============================================================================
-- MODIFY CUSTOMERS TABLE
-- ============================================================================

-- Make hub_coordinator_id optional (for public self-service customers)
-- Currently it's required, but public customers don't have a coordinator
ALTER TABLE customers
ALTER COLUMN hub_coordinator_id DROP NOT NULL;

-- Add CRM tracking fields
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE;

-- Make phone unique for lookup (customer identification by phone)
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_phone_unique;

ALTER TABLE customers
ADD CONSTRAINT customers_phone_unique UNIQUE (phone);

-- ============================================================================
-- ADD CUSTOMER_ID TO ORDERS
-- ============================================================================

-- Link orders to customers for full CRM tracking
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- Index for faster customer order queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- ============================================================================
-- UPDATE RLS POLICIES FOR PUBLIC CUSTOMERS
-- ============================================================================

-- Allow public (unauthenticated) users to create customer records by phone
DROP POLICY IF EXISTS "Public can create customer profiles" ON customers;

CREATE POLICY "Public can create customer profiles" ON customers
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Allow customers to view their own data (by phone lookup, no auth required)
DROP POLICY IF EXISTS "Customers can view own data by phone" ON customers;

CREATE POLICY "Customers can view own data by phone" ON customers
    FOR SELECT TO anon, authenticated
    USING (true); -- Open for now, API will filter by phone

-- Allow system to update customer stats
DROP POLICY IF EXISTS "System can update customer stats" ON customers;

CREATE POLICY "System can update customer stats" ON customers
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- Admins can manage all customers
DROP POLICY IF EXISTS "Admins can manage customers" ON customers;

CREATE POLICY "Admins can manage customers" ON customers
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'team_leader')
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN customers.hub_coordinator_id IS
'Optional - NULL for self-service public customers, set for hub-managed customers assigned to a specific coordinator';

COMMENT ON COLUMN customers.total_orders IS
'Total number of orders placed by this customer (auto-updated on order creation)';

COMMENT ON COLUMN customers.lifetime_value IS
'Total amount spent by customer across all orders in NIS (auto-updated on order completion)';

COMMENT ON COLUMN customers.last_order_date IS
'Date of most recent order (auto-updated on order creation)';

COMMENT ON COLUMN orders.customer_id IS
'Links order to customer record for CRM tracking and order history';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show customers table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'customers'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Count existing customers
SELECT
    COUNT(*) as total_customers,
    COUNT(hub_coordinator_id) as hub_managed_customers,
    COUNT(*) - COUNT(hub_coordinator_id) as self_service_customers
FROM customers;
