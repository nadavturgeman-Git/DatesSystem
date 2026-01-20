-- Fix Missing RLS Policies
-- Run this in Supabase SQL Editor to fix admin access issues
-- URL: https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/sql
-- Date: 2026-01-13

-- Warehouses: Everyone can read active, only admins can modify
CREATE POLICY IF NOT EXISTS "Anyone can view active warehouses" ON warehouses
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY IF NOT EXISTS "Admins can manage warehouses" ON warehouses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Pallets: Everyone can read, only admins can modify
CREATE POLICY IF NOT EXISTS "Anyone can view pallets" ON pallets
    FOR SELECT USING (TRUE);

CREATE POLICY IF NOT EXISTS "Admins can manage pallets" ON pallets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Customers: Coordinators can view their own, admins can view all
CREATE POLICY IF NOT EXISTS "Coordinators can view own customers" ON customers
    FOR SELECT USING (
        hub_coordinator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Coordinators can manage own customers" ON customers
    FOR ALL USING (
        hub_coordinator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Distributor profiles: Users can view their own, admins can view all
CREATE POLICY IF NOT EXISTS "Users can view own distributor profile" ON distributor_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage distributor profiles" ON distributor_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Order items: Same as orders
CREATE POLICY IF NOT EXISTS "Distributors can view own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (
                orders.distributor_id = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE id = auth.uid() AND role IN ('admin', 'team_leader')
                )
            )
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage order items" ON order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Pallet allocations: Same as orders
CREATE POLICY IF NOT EXISTS "Admins can view pallet allocations" ON pallet_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage pallet allocations" ON pallet_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Stock reservations: Same as orders
CREATE POLICY IF NOT EXISTS "Admins can view stock reservations" ON stock_reservations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage stock reservations" ON stock_reservations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Returns: Distributors can view their own, admins can view all
CREATE POLICY IF NOT EXISTS "Distributors can view own returns" ON returns
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Delivery sheets: Admins can view all
CREATE POLICY IF NOT EXISTS "Admins can view delivery sheets" ON delivery_sheets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage delivery sheets" ON delivery_sheets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Delivery sheet items: Same as delivery sheets
CREATE POLICY IF NOT EXISTS "Admins can view delivery sheet items" ON delivery_sheet_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage delivery sheet items" ON delivery_sheet_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Alerts: Users can view their own, admins can view all
CREATE POLICY IF NOT EXISTS "Users can view own alerts" ON alerts
    FOR SELECT USING (
        target_user_id = auth.uid() OR
        target_user_id IS NULL OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage alerts" ON alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Performance metrics: Distributors can view their own, admins can view all
CREATE POLICY IF NOT EXISTS "Distributors can view own performance" ON performance_metrics
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY IF NOT EXISTS "Admins can manage performance metrics" ON performance_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sales cycles: Everyone can read active, only admins can modify
CREATE POLICY IF NOT EXISTS "Anyone can view active sales cycles" ON sales_cycles
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY IF NOT EXISTS "Admins can manage sales cycles" ON sales_cycles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Notifications: Users can view their own
CREATE POLICY IF NOT EXISTS "Users can view own notifications" ON notifications
    FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own notifications" ON notifications
    FOR UPDATE USING (recipient_id = auth.uid());

-- Verify policies were created
SELECT tablename, policyname FROM pg_policies 
WHERE tablename IN ('pallets', 'products', 'warehouses', 'customers', 'distributor_profiles', 'order_items', 'pallet_allocations', 'stock_reservations', 'returns', 'delivery_sheets', 'delivery_sheet_items', 'alerts', 'performance_metrics', 'sales_cycles', 'notifications')
ORDER BY tablename, policyname;
