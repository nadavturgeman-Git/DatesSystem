-- Date Palm Farm Management System - Database Schema
-- Generated: 2026-01-07
-- PostgreSQL + Supabase

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'team_leader', 'distributor');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('credit_card', 'bit', 'paybox', 'cash');
CREATE TYPE commission_type AS ENUM ('distributor', 'team_leader');
CREATE TYPE commission_payment_type AS ENUM ('cash', 'goods');
CREATE TYPE commission_settlement_type AS ENUM ('invoice_payslip', 'group_discount'); -- Invoice/Payslip vs Group Discount (הנחה קבוצתית)
CREATE TYPE warehouse_type AS ENUM ('freezing', 'cooling');
CREATE TYPE return_reason AS ENUM ('damaged', 'missed_collection', 'quality_issue', 'other');
CREATE TYPE alert_type AS ENUM ('low_performance', 'spoilage_warning', 'stock_low', 'reservation_expired');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'distributor',
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255) NOT NULL,
    team_leader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Distributor-specific profile (payment preferences)
CREATE TABLE distributor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    preferred_payment_method payment_method NOT NULL DEFAULT 'cash',
    paybox_link VARCHAR(500),
    credit_card_last4 VARCHAR(4),
    commission_rate DECIMAL(5, 2) DEFAULT 15.00, -- Base rate, can be overridden
    prefers_commission_in_goods BOOLEAN DEFAULT FALSE,
    account_balance DECIMAL(12, 2) DEFAULT 0.00, -- Credits from returns/damages
    is_group_discount BOOLEAN DEFAULT FALSE, -- TRUE for Group Discount (הנחה קבוצתית), FALSE for Invoice/Payslip
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Warehouses (Dual System: Freezing + Cooling)
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    warehouse_type warehouse_type NOT NULL,
    location VARCHAR(500),
    capacity_kg DECIMAL(12, 2),
    spoilage_alert_days INTEGER, -- For cooling warehouses: alert when items exceed this duration
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products (Date varieties)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    variety VARCHAR(100), -- e.g., Medjool, Deglet Noor, etc.
    description TEXT,
    price_per_kg DECIMAL(10, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pallets (FIFO Inventory Tracking)
CREATE TABLE pallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pallet_id VARCHAR(100) NOT NULL UNIQUE, -- Human-readable pallet ID
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    initial_weight_kg DECIMAL(10, 2) NOT NULL,
    current_weight_kg DECIMAL(10, 2) NOT NULL,
    batch_number VARCHAR(100),
    expiry_date DATE,
    is_depleted BOOLEAN DEFAULT FALSE,
    is_fresh_fruit BOOLEAN DEFAULT FALSE, -- For fresh fruit requiring cooling warehouse monitoring
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT positive_weight CHECK (current_weight_kg >= 0),
    CONSTRAINT weight_consistency CHECK (current_weight_kg <= initial_weight_kg)
);

-- Index for FIFO queries (oldest first)
CREATE INDEX idx_pallets_fifo ON pallets(product_id, entry_date ASC, is_depleted)
WHERE is_depleted = FALSE;

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) NOT NULL UNIQUE,
    distributor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_method payment_method,
    total_weight_kg DECIMAL(10, 2) NOT NULL DEFAULT 0,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    commission_amount DECIMAL(12, 2) DEFAULT 0,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE,
    reservation_expires_at TIMESTAMP WITH TIME ZONE, -- For virtual locking

    CONSTRAINT positive_amounts CHECK (total_amount >= 0)
);

CREATE INDEX idx_orders_distributor ON orders(distributor_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_reservation_expiry ON orders(reservation_expires_at)
WHERE payment_status = 'pending';

-- Order Items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_kg DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT positive_quantity CHECK (quantity_kg > 0)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Pallet Allocations (tracks which pallets were used for which orders)
CREATE TABLE pallet_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    pallet_id UUID NOT NULL REFERENCES pallets(id) ON DELETE RESTRICT,
    allocated_weight_kg DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT positive_allocation CHECK (allocated_weight_kg > 0)
);

CREATE INDEX idx_pallet_allocations_pallet ON pallet_allocations(pallet_id);
CREATE INDEX idx_pallet_allocations_order_item ON pallet_allocations(order_item_id);

-- Stock Reservations (Virtual Locking)
CREATE TABLE stock_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    pallet_id UUID NOT NULL REFERENCES pallets(id) ON DELETE CASCADE,
    reserved_weight_kg DECIMAL(10, 2) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    released_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT positive_reservation CHECK (reserved_weight_kg > 0)
);

CREATE INDEX idx_stock_reservations_active ON stock_reservations(pallet_id, is_active, expires_at);
CREATE INDEX idx_stock_reservations_order ON stock_reservations(order_id);

-- Commissions
CREATE TABLE commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    commission_type commission_type NOT NULL,
    payment_type commission_payment_type NOT NULL DEFAULT 'cash',
    settlement_type commission_settlement_type DEFAULT 'invoice_payslip', -- Invoice/Payslip vs Group Discount
    base_amount DECIMAL(12, 2) NOT NULL, -- Order amount used for calculation
    commission_rate DECIMAL(5, 2) NOT NULL, -- Percentage applied
    commission_amount DECIMAL(12, 2) NOT NULL, -- Final commission in NIS
    product_id UUID REFERENCES products(id), -- If paid in goods
    product_quantity_kg DECIMAL(10, 2), -- If paid in goods
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT positive_commission CHECK (commission_amount >= 0)
);

CREATE INDEX idx_commissions_user ON commissions(user_id);
CREATE INDEX idx_commissions_order ON commissions(order_id);
CREATE INDEX idx_commissions_unpaid ON commissions(is_paid) WHERE is_paid = FALSE;

-- Returns & Damage Reports
CREATE TABLE returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    distributor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    reason return_reason NOT NULL,
    description TEXT,
    quantity_kg DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(12, 2) NOT NULL,
    applied_to_balance BOOLEAN DEFAULT TRUE, -- If false, recorded as waste
    approved_by UUID REFERENCES profiles(id), -- Admin who approved
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT positive_return_quantity CHECK (quantity_kg > 0)
);

CREATE INDEX idx_returns_distributor ON returns(distributor_id);
CREATE INDEX idx_returns_order ON returns(order_id);
CREATE INDEX idx_returns_pending ON returns(is_approved) WHERE is_approved = FALSE;

-- Delivery Sheets (Generated for drivers)
CREATE TABLE delivery_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sheet_number VARCHAR(50) NOT NULL UNIQUE,
    driver_name VARCHAR(255),
    delivery_date DATE NOT NULL,
    spare_inventory_kg DECIMAL(10, 2) DEFAULT 0, -- Manager-designated spare for driver
    notes TEXT,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_delivery_sheets_date ON delivery_sheets(delivery_date);

-- Delivery Sheet Items (Per-hub quantities)
CREATE TABLE delivery_sheet_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_sheet_id UUID NOT NULL REFERENCES delivery_sheets(id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity_kg DECIMAL(10, 2) NOT NULL,
    delivered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT positive_delivery_quantity CHECK (quantity_kg > 0)
);

CREATE INDEX idx_delivery_sheet_items_sheet ON delivery_sheet_items(delivery_sheet_id);
CREATE INDEX idx_delivery_sheet_items_distributor ON delivery_sheet_items(distributor_id);

-- System Alerts (Low performance, spoilage, etc.)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type alert_type NOT NULL,
    target_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Specific user if applicable
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB, -- Additional context (e.g., warehouse_id, product_id, threshold)
    is_read BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_alerts_user ON alerts(target_user_id);
CREATE INDEX idx_alerts_unread ON alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_alerts_unresolved ON alerts(is_resolved) WHERE is_resolved = FALSE;

-- Performance Tracking (For 50kg Rule)
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sales_cycle_start DATE NOT NULL,
    sales_cycle_end DATE NOT NULL,
    total_weight_kg DECIMAL(10, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12, 2) DEFAULT 0,
    met_minimum_threshold BOOLEAN DEFAULT FALSE, -- 50kg rule
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(distributor_id, sales_cycle_start)
);

CREATE INDEX idx_performance_metrics_distributor ON performance_metrics(distributor_id);
CREATE INDEX idx_performance_metrics_cycle ON performance_metrics(sales_cycle_start, sales_cycle_end);
CREATE INDEX idx_performance_metrics_threshold ON performance_metrics(met_minimum_threshold);

-- End Customers (Self-service ordering with CRM)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hub_coordinator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_coordinator ON customers(hub_coordinator_id);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_active ON customers(is_active) WHERE is_active = TRUE;

-- Sales Cycles (Ordering windows)
CREATE TABLE sales_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    minimum_order_kg DECIMAL(10, 2) DEFAULT 50.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_sales_cycles_active ON sales_cycles(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sales_cycles_dates ON sales_cycles(start_date, end_date);

-- Notifications (Customer pickup alerts, coordinator confirmations)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'pickup_ready', 'order_confirmed', 'payment_received', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_order ON notifications(order_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get available stock for a product (considering reservations)
CREATE OR REPLACE FUNCTION get_available_stock(p_product_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
    total_stock DECIMAL(10, 2);
    reserved_stock DECIMAL(10, 2);
BEGIN
    -- Get total current stock
    SELECT COALESCE(SUM(current_weight_kg), 0)
    INTO total_stock
    FROM pallets
    WHERE product_id = p_product_id
    AND is_depleted = FALSE;

    -- Get active reservations
    SELECT COALESCE(SUM(reserved_weight_kg), 0)
    INTO reserved_stock
    FROM stock_reservations
    WHERE pallet_id IN (
        SELECT id FROM pallets WHERE product_id = p_product_id
    )
    AND is_active = TRUE
    AND expires_at > NOW();

    RETURN total_stock - reserved_stock;
END;
$$ LANGUAGE plpgsql;

-- Function to release expired reservations
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    released_count INTEGER;
BEGIN
    UPDATE stock_reservations
    SET is_active = FALSE, released_at = NOW()
    WHERE is_active = TRUE
    AND expires_at <= NOW();

    GET DIAGNOSTICS released_count = ROW_COUNT;
    RETURN released_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate distributor commission rate based on weight
CREATE OR REPLACE FUNCTION calculate_distributor_commission_rate(p_weight_kg DECIMAL)
RETURNS DECIMAL(5, 2) AS $$
BEGIN
    IF p_weight_kg < 50 THEN
        RETURN 15.00;
    ELSIF p_weight_kg >= 50 AND p_weight_kg <= 75 THEN
        RETURN 17.00;
    ELSE
        RETURN 20.00;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributor_profiles_updated_at BEFORE UPDATE ON distributor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pallets_updated_at BEFORE UPDATE ON pallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_performance_metrics_updated_at BEFORE UPDATE ON performance_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_cycles_updated_at BEFORE UPDATE ON sales_cycles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE distributor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pallet_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_sheet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, admins can read all
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Distributors can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow signup to create own profile
CREATE POLICY "Allow signup to create own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Products: Everyone can read, only admins can modify
CREATE POLICY "Anyone can view active products" ON products
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage products" ON products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Orders: Distributors can view their own, admins can view all
CREATE POLICY "Distributors can view own orders" ON orders
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'team_leader')
        )
    );

CREATE POLICY "Distributors can create orders" ON orders
    FOR INSERT WITH CHECK (distributor_id = auth.uid());

CREATE POLICY "Admins can manage all orders" ON orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Commissions: Users can view their own, admins can view all
CREATE POLICY "Users can view own commissions" ON commissions
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Warehouses: Everyone can read active, only admins can modify
CREATE POLICY "Anyone can view active warehouses" ON warehouses
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage warehouses" ON warehouses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Pallets: Everyone can read, only admins can modify
CREATE POLICY "Anyone can view pallets" ON pallets
    FOR SELECT USING (TRUE);

CREATE POLICY "Admins can manage pallets" ON pallets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Customers: Coordinators can view their own, admins can view all
CREATE POLICY "Coordinators can view own customers" ON customers
    FOR SELECT USING (
        hub_coordinator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Coordinators can manage own customers" ON customers
    FOR ALL USING (
        hub_coordinator_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Distributor profiles: Users can view their own, admins can view all
CREATE POLICY "Users can view own distributor profile" ON distributor_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage distributor profiles" ON distributor_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Order items: Same as orders
CREATE POLICY "Distributors can view own order items" ON order_items
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

CREATE POLICY "Admins can manage order items" ON order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Pallet allocations: Same as orders
CREATE POLICY "Admins can view pallet allocations" ON pallet_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage pallet allocations" ON pallet_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Stock reservations: Same as orders
CREATE POLICY "Admins can view stock reservations" ON stock_reservations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage stock reservations" ON stock_reservations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Returns: Distributors can view their own, admins can view all
CREATE POLICY "Distributors can view own returns" ON returns
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Delivery sheets: Admins can view all
CREATE POLICY "Admins can view delivery sheets" ON delivery_sheets
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage delivery sheets" ON delivery_sheets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Delivery sheet items: Same as delivery sheets
CREATE POLICY "Admins can view delivery sheet items" ON delivery_sheet_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage delivery sheet items" ON delivery_sheet_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Alerts: Users can view their own, admins can view all
CREATE POLICY "Users can view own alerts" ON alerts
    FOR SELECT USING (
        target_user_id = auth.uid() OR
        target_user_id IS NULL OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage alerts" ON alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Performance metrics: Distributors can view their own, admins can view all
CREATE POLICY "Distributors can view own performance" ON performance_metrics
    FOR SELECT USING (
        distributor_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can manage performance metrics" ON performance_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Sales cycles: Everyone can read active, only admins can modify
CREATE POLICY "Anyone can view active sales cycles" ON sales_cycles
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage sales cycles" ON sales_cycles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Notifications: Users can view their own
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (recipient_id = auth.uid());

-- ============================================================================
-- SEED DATA (Optional - for development)
-- ============================================================================

-- Insert dual warehouse system
INSERT INTO warehouses (name, warehouse_type, location, capacity_kg, spoilage_alert_days) VALUES
('Baqaa Warehouse', 'freezing', 'Baqaa', 50000.00, NULL),
('Jerusalem Warehouse', 'cooling', 'Jerusalem', 10000.00, 7); -- Alert after 7 days

-- Insert sample products
INSERT INTO products (name, variety, price_per_kg) VALUES
('Medjool Dates', 'Medjool', 45.00),
('Deglet Noor Dates', 'Deglet Noor', 35.00),
('Barhi Dates', 'Barhi', 40.00);
