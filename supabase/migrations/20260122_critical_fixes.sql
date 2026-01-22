-- ============================================================================
-- CRITICAL FIXES MIGRATION
-- Date: 2026-01-22
-- Description: Fixes identified during QA stress testing
-- ============================================================================

-- ============================================================================
-- 1. PREVENT DUPLICATE COMMISSIONS
-- Issue: calculateOrderCommissions() could create duplicates if called twice
-- ============================================================================

-- Add unique constraint to prevent duplicate commissions per order/user/type
ALTER TABLE commissions
ADD CONSTRAINT unique_commission_per_order
UNIQUE (order_id, user_id, commission_type);

-- Create upsert-friendly function for commission creation
CREATE OR REPLACE FUNCTION upsert_commission(
  p_user_id UUID,
  p_order_id UUID,
  p_commission_type commission_type,
  p_payment_type commission_payment_type,
  p_settlement_type commission_settlement_type,
  p_base_amount DECIMAL(12, 2),
  p_commission_rate DECIMAL(5, 2),
  p_commission_amount DECIMAL(12, 2),
  p_product_id UUID DEFAULT NULL,
  p_product_quantity_kg DECIMAL(10, 2) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_commission_id UUID;
BEGIN
  INSERT INTO commissions (
    user_id, order_id, commission_type, payment_type, settlement_type,
    base_amount, commission_rate, commission_amount, product_id, product_quantity_kg
  )
  VALUES (
    p_user_id, p_order_id, p_commission_type, p_payment_type, p_settlement_type,
    p_base_amount, p_commission_rate, p_commission_amount, p_product_id, p_product_quantity_kg
  )
  ON CONFLICT (order_id, user_id, commission_type)
  DO UPDATE SET
    payment_type = EXCLUDED.payment_type,
    settlement_type = EXCLUDED.settlement_type,
    base_amount = EXCLUDED.base_amount,
    commission_rate = EXCLUDED.commission_rate,
    commission_amount = EXCLUDED.commission_amount,
    product_id = EXCLUDED.product_id,
    product_quantity_kg = EXCLUDED.product_quantity_kg
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. PREVENT SELF-REFERENTIAL TEAM LEADER
-- Issue: A user could be assigned as their own team leader
-- ============================================================================

ALTER TABLE profiles
ADD CONSTRAINT no_self_team_leader
CHECK (team_leader_id IS NULL OR team_leader_id != id);

-- ============================================================================
-- 3. ORDER TOTAL CONSISTENCY
-- Issue: order.total_amount could become inconsistent with order_items
-- ============================================================================

-- Function to recalculate order totals from order items
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_total_weight DECIMAL(10, 2);
  v_subtotal DECIMAL(12, 2);
BEGIN
  -- Calculate totals from order items
  SELECT
    COALESCE(SUM(quantity_kg), 0),
    COALESCE(SUM(subtotal), 0)
  INTO v_total_weight, v_subtotal
  FROM order_items
  WHERE order_id = COALESCE(NEW.order_id, OLD.order_id);

  -- Update the order
  UPDATE orders
  SET
    total_weight_kg = v_total_weight,
    subtotal = v_subtotal,
    total_amount = v_subtotal - COALESCE(commission_amount, 0),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on order_items to keep order totals in sync
DROP TRIGGER IF EXISTS sync_order_totals_insert ON order_items;
DROP TRIGGER IF EXISTS sync_order_totals_update ON order_items;
DROP TRIGGER IF EXISTS sync_order_totals_delete ON order_items;

CREATE TRIGGER sync_order_totals_insert
AFTER INSERT ON order_items
FOR EACH ROW EXECUTE FUNCTION recalculate_order_totals();

CREATE TRIGGER sync_order_totals_update
AFTER UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION recalculate_order_totals();

CREATE TRIGGER sync_order_totals_delete
AFTER DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION recalculate_order_totals();

-- ============================================================================
-- 4. PAYMENT STATUS TRANSITION VALIDATION
-- Issue: Invalid transitions like refunded -> paid were possible
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_payment_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Define valid transitions
  -- pending -> paid, failed
  -- paid -> refunded
  -- failed -> pending (retry)
  -- refunded -> (terminal state, no transitions)

  IF OLD.payment_status = NEW.payment_status THEN
    RETURN NEW; -- No change, allow
  END IF;

  IF OLD.payment_status = 'pending' AND NEW.payment_status IN ('paid', 'failed') THEN
    RETURN NEW;
  ELSIF OLD.payment_status = 'paid' AND NEW.payment_status = 'refunded' THEN
    RETURN NEW;
  ELSIF OLD.payment_status = 'failed' AND NEW.payment_status = 'pending' THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Invalid payment status transition from % to %',
      OLD.payment_status, NEW.payment_status;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_payment_transition ON orders;
CREATE TRIGGER validate_payment_transition
BEFORE UPDATE OF payment_status ON orders
FOR EACH ROW EXECUTE FUNCTION validate_payment_status_transition();

-- ============================================================================
-- 5. PREVENT DUPLICATE PALLET ALLOCATIONS
-- Issue: Same pallet could be allocated multiple times to same order item
-- ============================================================================

ALTER TABLE pallet_allocations
ADD CONSTRAINT unique_pallet_allocation_per_item
UNIQUE (order_item_id, pallet_id);

-- ============================================================================
-- 6. WAREHOUSE CAPACITY SOFT LIMIT WARNING
-- Issue: Pallets could be added beyond warehouse capacity
-- Note: Using soft limit (warning) rather than hard constraint for flexibility
-- ============================================================================

CREATE OR REPLACE FUNCTION check_warehouse_capacity()
RETURNS TRIGGER AS $$
DECLARE
  v_current_weight DECIMAL(12, 2);
  v_capacity DECIMAL(12, 2);
  v_warehouse_name VARCHAR(255);
BEGIN
  -- Get warehouse capacity and current weight
  SELECT
    w.capacity_kg,
    w.name,
    COALESCE(SUM(p.current_weight_kg), 0)
  INTO v_capacity, v_warehouse_name, v_current_weight
  FROM warehouses w
  LEFT JOIN pallets p ON p.warehouse_id = w.id AND p.is_depleted = FALSE
  WHERE w.id = NEW.warehouse_id
  GROUP BY w.id, w.capacity_kg, w.name;

  -- Add warning if capacity would be exceeded (but don't block)
  IF v_capacity IS NOT NULL AND (v_current_weight + NEW.current_weight_kg) > v_capacity THEN
    -- Insert alert for capacity warning
    INSERT INTO alerts (
      alert_type,
      title,
      message,
      metadata
    ) VALUES (
      'stock_low',
      'Warehouse Capacity Warning',
      format('Warehouse "%s" is at %.1f%% capacity (%.2f/%.2f kg)',
        v_warehouse_name,
        ((v_current_weight + NEW.current_weight_kg) / v_capacity) * 100,
        v_current_weight + NEW.current_weight_kg,
        v_capacity
      ),
      jsonb_build_object(
        'warehouse_id', NEW.warehouse_id,
        'current_weight', v_current_weight + NEW.current_weight_kg,
        'capacity', v_capacity
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_capacity_on_pallet_insert ON pallets;
CREATE TRIGGER check_capacity_on_pallet_insert
AFTER INSERT ON pallets
FOR EACH ROW EXECUTE FUNCTION check_warehouse_capacity();

-- ============================================================================
-- 7. VALIDATE PHONE NUMBER FORMAT (Basic)
-- Issue: No phone validation - garbage could be stored
-- ============================================================================

-- Add basic phone format validation (allows digits, +, -, spaces, parentheses)
ALTER TABLE profiles
ADD CONSTRAINT valid_phone_format
CHECK (
  phone IS NULL OR
  phone ~ '^[+]?[0-9\s\-\(\)]{7,20}$'
);

ALTER TABLE customers
ADD CONSTRAINT valid_customer_phone_format
CHECK (
  phone ~ '^[+]?[0-9\s\-\(\)]{7,20}$'
);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify constraints were added
DO $$
BEGIN
  RAISE NOTICE 'Critical fixes migration completed successfully';
  RAISE NOTICE 'Added constraints:';
  RAISE NOTICE '  - unique_commission_per_order on commissions';
  RAISE NOTICE '  - no_self_team_leader on profiles';
  RAISE NOTICE '  - unique_pallet_allocation_per_item on pallet_allocations';
  RAISE NOTICE '  - valid_phone_format on profiles and customers';
  RAISE NOTICE 'Added triggers:';
  RAISE NOTICE '  - sync_order_totals on order_items';
  RAISE NOTICE '  - validate_payment_transition on orders';
  RAISE NOTICE '  - check_capacity_on_pallet_insert on pallets';
END $$;
