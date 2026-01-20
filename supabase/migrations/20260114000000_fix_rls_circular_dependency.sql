-- Fix RLS Circular Dependency Issue
-- The problem: RLS policies check if user is admin by querying profiles table,
-- but profiles table RLS might block that query, creating a circular dependency.
-- Solution: Create a helper function that bypasses RLS to check user role.

-- Create a function to get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
DECLARE
    user_role_val user_role;
BEGIN
    SELECT role INTO user_role_val
    FROM profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(user_role_val, 'distributor'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if current user is team_leader
CREATE OR REPLACE FUNCTION auth.is_team_leader()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.user_role() = 'team_leader';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Now update all RLS policies to use these functions instead of EXISTS queries

-- Drop and recreate profiles policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR ALL USING (public.is_admin());

-- Drop and recreate products policies
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (public.is_admin());

-- Drop and recreate orders policies
DROP POLICY IF EXISTS "Distributors can view own orders" ON orders;
CREATE POLICY "Distributors can view own orders" ON orders
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        public.is_admin() OR
        public.is_team_leader()
    );

DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (public.is_admin());

-- Drop and recreate commissions policies
DROP POLICY IF EXISTS "Users can view own commissions" ON commissions;
CREATE POLICY "Users can view own commissions" ON commissions
    FOR SELECT USING (
        user_id = auth.uid() OR
        auth.is_admin()
    );

-- Drop and recreate warehouses policies
DROP POLICY IF EXISTS "Admins can manage warehouses" ON warehouses;
CREATE POLICY "Admins can manage warehouses" ON warehouses
    FOR ALL USING (public.is_admin());

-- Drop and recreate pallets policies
DROP POLICY IF EXISTS "Admins can manage pallets" ON pallets;
CREATE POLICY "Admins can manage pallets" ON pallets
    FOR ALL USING (public.is_admin());

-- Drop and recreate customers policies
DROP POLICY IF EXISTS "Coordinators can view own customers" ON customers;
CREATE POLICY "Coordinators can view own customers" ON customers
    FOR SELECT USING (
        hub_coordinator_id = auth.uid() OR
        auth.is_admin()
    );

DROP POLICY IF EXISTS "Coordinators can manage own customers" ON customers;
CREATE POLICY "Coordinators can manage own customers" ON customers
    FOR ALL USING (
        hub_coordinator_id = auth.uid() OR
        auth.is_admin()
    );

-- Drop and recreate distributor_profiles policies
DROP POLICY IF EXISTS "Users can view own distributor profile" ON distributor_profiles;
CREATE POLICY "Users can view own distributor profile" ON distributor_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        auth.is_admin()
    );

DROP POLICY IF EXISTS "Admins can manage distributor profiles" ON distributor_profiles;
CREATE POLICY "Admins can manage distributor profiles" ON distributor_profiles
    FOR ALL USING (public.is_admin());

-- Drop and recreate order_items policies
DROP POLICY IF EXISTS "Distributors can view own order items" ON order_items;
CREATE POLICY "Distributors can view own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
            AND (orders.distributor_id = auth.uid() OR auth.is_admin() OR auth.is_team_leader())
        )
    );

DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;
CREATE POLICY "Admins can manage order items" ON order_items
    FOR ALL USING (public.is_admin());

-- Drop and recreate pallet_allocations policies
DROP POLICY IF EXISTS "Admins can view pallet allocations" ON pallet_allocations;
CREATE POLICY "Admins can view pallet allocations" ON pallet_allocations
    FOR SELECT USING (auth.is_admin());

DROP POLICY IF EXISTS "Admins can manage pallet allocations" ON pallet_allocations;
CREATE POLICY "Admins can manage pallet allocations" ON pallet_allocations
    FOR ALL USING (public.is_admin());

-- Drop and recreate stock_reservations policies
DROP POLICY IF EXISTS "Admins can view stock reservations" ON stock_reservations;
CREATE POLICY "Admins can view stock reservations" ON stock_reservations
    FOR SELECT USING (auth.is_admin());

DROP POLICY IF EXISTS "Admins can manage stock reservations" ON stock_reservations;
CREATE POLICY "Admins can manage stock reservations" ON stock_reservations
    FOR ALL USING (public.is_admin());

-- Drop and recreate returns policies
DROP POLICY IF EXISTS "Distributors can view own returns" ON returns;
CREATE POLICY "Distributors can view own returns" ON returns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = returns.order_id
            AND (orders.distributor_id = auth.uid() OR auth.is_admin())
        )
    );

DROP POLICY IF EXISTS "Admins can manage returns" ON returns;
CREATE POLICY "Admins can manage returns" ON returns
    FOR ALL USING (public.is_admin());

-- Drop and recreate delivery_sheets policies
DROP POLICY IF EXISTS "Admins can view delivery sheets" ON delivery_sheets;
CREATE POLICY "Admins can view delivery sheets" ON delivery_sheets
    FOR SELECT USING (auth.is_admin() OR auth.is_team_leader());

DROP POLICY IF EXISTS "Admins can manage delivery sheets" ON delivery_sheets;
CREATE POLICY "Admins can manage delivery sheets" ON delivery_sheets
    FOR ALL USING (public.is_admin());

-- Drop and recreate delivery_sheet_items policies
DROP POLICY IF EXISTS "Admins can view delivery sheet items" ON delivery_sheet_items;
CREATE POLICY "Admins can view delivery sheet items" ON delivery_sheet_items
    FOR SELECT USING (auth.is_admin() OR auth.is_team_leader());

DROP POLICY IF EXISTS "Admins can manage delivery sheet items" ON delivery_sheet_items;
CREATE POLICY "Admins can manage delivery sheet items" ON delivery_sheet_items
    FOR ALL USING (public.is_admin());

-- Drop and recreate alerts policies
DROP POLICY IF EXISTS "Users can view own alerts" ON alerts;
CREATE POLICY "Users can view own alerts" ON alerts
    FOR SELECT USING (
        target_user_id = auth.uid() OR
        target_user_id IS NULL OR
        auth.is_admin()
    );

DROP POLICY IF EXISTS "Admins can manage alerts" ON alerts;
CREATE POLICY "Admins can manage alerts" ON alerts
    FOR ALL USING (public.is_admin());

-- Drop and recreate performance_metrics policies
DROP POLICY IF EXISTS "Distributors can view own performance" ON performance_metrics;
CREATE POLICY "Distributors can view own performance" ON performance_metrics
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        public.is_admin() OR
        public.is_team_leader()
    );

DROP POLICY IF EXISTS "Admins can manage performance metrics" ON performance_metrics;
CREATE POLICY "Admins can manage performance metrics" ON performance_metrics
    FOR ALL USING (public.is_admin());

-- Drop and recreate sales_cycles policies
DROP POLICY IF EXISTS "Admins can manage sales cycles" ON sales_cycles;
CREATE POLICY "Admins can manage sales cycles" ON sales_cycles
    FOR ALL USING (public.is_admin());

-- Grant execute permissions on the helper functions
GRANT EXECUTE ON FUNCTION public.user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_leader() TO authenticated;
