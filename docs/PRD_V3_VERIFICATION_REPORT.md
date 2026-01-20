# PRD v3.0 Implementation Verification Report

**Date**: 2026-01-18
**Status**: Comprehensive verification complete

---

## 🔍 WHAT EXISTS (Already Implemented)

### ✅ Database Schema

| Feature | Status | Details |
|---------|--------|---------|
| `customers` table | ✅ EXISTS | Lines 294-309 in `supabase-schema.sql` |
| `employment_model` ENUM | ✅ EXISTS | 3 values: `Credit_Commission`, `Cash_Paybox`, `Goods_Commission` |
| `delivery_status` ENUM | ✅ EXISTS | 4 values: `Pending`, `In_Transit`, `Delivered_to_Distributor`, `Picked_up_by_Customer` |
| `order_status` ENUM | ✅ EXISTS | 6 values: `pending`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled` |
| `payment_method` ENUM | ✅ EXISTS | 4 values: `credit_card`, `bit`, `paybox`, `cash` |
| `orders.delivery_status` column | ✅ EXISTS | Separate from order_status, tracks physical delivery |
| `distributor_profiles.employment_model` | ✅ EXISTS | Links to employment_model ENUM |
| `returns` table | ✅ EXISTS | For damage/refund tracking |

**Key Finding**: `customers` table EXISTS but has `hub_coordinator_id` (required FK to distributor) - designed for hub-managed customers, NOT independent public customers.

---

### ✅ Customer-Facing Pages

| Page | Path | Status | Functionality |
|------|------|--------|---------------|
| Catalog | `/customer/catalog` | ✅ EXISTS | Product browsing |
| Checkout | `/customer/checkout` | ✅ EXISTS | Full checkout flow with payment config |
| My Orders | `/customer/my-orders` | ✅ EXISTS | Order history, uses delivery_status |
| Order Confirmation | `/customer/my-orders/[id]/confirmation` | ✅ EXISTS | Post-order confirmation |

**Key Finding**: There's a full `/customer/` flow already built! Separate from `/order/[distributorId]` flow.

---

### ✅ Public Order Page

| Page | Path | Status | Functionality |
|------|------|--------|---------------|
| Public Order | `/order/[distributorId]` | ✅ EXISTS | Direct distributor link orders |
| Order Confirmation | `/order/[distributorId]/confirmation` | ✅ EXISTS | Shows order details |

**Key Finding**: TWO separate order flows exist:
1. `/customer/*` - Authenticated customer flow with cart
2. `/order/[distributorId]` - Public unauthenticated direct distributor link

---

### ✅ API Endpoints

| Endpoint | Status | Purpose |
|----------|--------|---------|
| `/api/checkout/products` | ✅ EXISTS | Get products for checkout (bypasses RLS) |
| `/api/checkout/distributor` | ✅ EXISTS | Get distributor info (bypasses RLS) |
| `/api/checkout/payment-config` | ✅ EXISTS | Get payment config based on employment_model |
| `/api/catalog/products` | ✅ EXISTS | Public product listing |
| `/api/catalog/distributors` | ✅ EXISTS | List all distributors |
| `/api/my-orders/list` | ✅ EXISTS | Get user's orders |
| `/api/orders/create-public` | ✅ EXISTS | Create order from public page |
| `/api/orders/create` | ✅ EXISTS | Create order (authenticated) |
| `/api/orders/preview` | ✅ EXISTS | FIFO preview |

**Key Finding**: Robust API layer exists for both authenticated and public flows!

---

### ✅ Payment Configuration

**File**: `src/app/api/checkout/payment-config/route.ts`

**Status**: ✅ FULLY IMPLEMENTED

The system ALREADY reads `employment_model` from `distributor_profiles` and returns dynamic payment config:
- `Credit_Commission` → Shows credit card payment
- `Cash_Paybox` → Shows Paybox link or cash instructions
- `Goods_Commission` → Shows goods commission message

**This is already working!**

---

### ✅ Order Status Tracking

**File**: `src/app/(customer)/my-orders/page.tsx`

**Status**: ✅ DELIVERY STATUS IMPLEMENTED

The UI ALREADY displays `delivery_status` including:
- `Picked_up_by_Customer` → Shows "נאסף" (Picked up)
- `Delivered_to_Distributor` → Shows "מוכן לאיסוף" (Ready for pickup)
- `In_Transit` → Shows "בדרך" (In transit)

**Lines 86-95** handle delivery_status display.

---

## ❌ WHAT'S MISSING (Needs Implementation)

### 1. Distributor Onboarding - Settlement Profile Selection ❌

**Gap**: Signup form does NOT ask for settlement profile selection

**File to Update**: `src/app/(auth)/signup/page.tsx`

**Current State**:
- Form collects: full_name, email, phone, password
- Does NOT create `distributor_profile` record
- Does NOT ask for settlement profile

**What's Needed**:
1. Add dropdown with 4 options:
   - Option 1: תלוש (Payslip) → Maps to `Payslip` enum value (NEW)
   - Option 2: עסק (Private Business) → Maps to `Private_Business` enum value (NEW)
   - Option 3: מזומן/Paybox → Maps to `Cash_Paybox` enum value
   - Option 4: סחורה (Goods Commission) → Maps to `Goods_Commission` enum value

2. Update `employment_model` ENUM from 3 to 4 values:
   ```sql
   ALTER TYPE employment_model ADD VALUE 'Payslip';
   ALTER TYPE employment_model ADD VALUE 'Private_Business';
   -- Keep existing: Cash_Paybox, Goods_Commission
   ```

3. Create `distributor_profile` record during signup

---

### 2. Sales Cycle UI Check ❌

**Gap**: Order pages do NOT check if sales cycle is active

**Files to Update**:
- `src/app/order/[distributorId]/page.tsx`
- `src/app/(customer)/catalog/page.tsx`

**Current State**:
- Order pages always show product catalog
- No sales cycle validation

**What's Needed**:
1. Query `sales_cycles` table for active cycle (`is_active = true`)
2. If NO active cycle:
   - Hide product grid
   - Show message: "מחזור מכירות סגור"
   - Fetch and display next cycle start date
3. If active cycle exists:
   - Show normal order form

---

### 3. Team Leader Refund Permissions ❌

**Gap**: RLS policy only allows `admin` role to manage returns

**File to Update**: Create migration SQL file

**Current RLS Policy** (lines 666-672 in supabase-schema.sql):
```sql
CREATE POLICY "Admins can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

**What's Needed**:
```sql
DROP POLICY IF EXISTS "Admins can manage returns" ON returns;

CREATE POLICY "Admins and Team Leaders can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'team_leader')
        )
    );
```

---

### 4. Customer CRM & Data Persistence ❌

**Gap**: Customer data is stored in `orders.notes` as text, not in `customers` table

**Current State**:
- `create-public/route.ts` line 83: Stores customer info as string in notes field
- No customer lookup by phone
- No customer profile page
- No lifetime value tracking
- Existing `customers` table requires `hub_coordinator_id` (wrong schema for public orders)

**What's Needed**:

1. **Modify `customers` table schema**:
   ```sql
   -- Make hub_coordinator_id optional (currently required)
   ALTER TABLE customers
   ALTER COLUMN hub_coordinator_id DROP NOT NULL;

   -- Add new fields for CRM
   ALTER TABLE customers
   ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
   ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(12,2) DEFAULT 0.00,
   ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE;

   -- Make phone UNIQUE for lookup
   ALTER TABLE customers
   ADD CONSTRAINT customers_phone_unique UNIQUE (phone);
   ```

2. **Create customer lookup API**: `/api/customers/lookup`
   - Input: phone number
   - Output: customer record or null
   - Auto-create on first order

3. **Update order creation**:
   - Lookup/create customer by phone
   - Link `orders.customer_id` to `customers.id`
   - Update customer stats (total_orders, lifetime_value)

4. **Create customer profile page**: `/customer/profile?phone=[phone]`
   - Show order history
   - Show total orders & lifetime value
   - Include "Report Fault" buttons (see #5)

5. **Update order page** to auto-fill returning customer data

**Schema Note**: Need to add `customer_id` column to orders table:
```sql
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
```

---

### 5. Fault Reporting with Photo Upload ❌

**Gap**: No fault reporting UI or image upload functionality

**Current State**:
- `returns` table exists
- NO image upload support
- NO customer-facing fault reporting UI
- NO Supabase Storage bucket for images

**What's Needed**:

1. **Update `returns` table**:
   ```sql
   ALTER TABLE returns
   ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';
   ```

2. **Create Supabase Storage bucket**:
   - Bucket name: `fault-reports`
   - Public read access
   - File size limit: 5MB per image
   - Max 5 images per report

3. **Create fault reporting page**: `/customer/report-fault?orderId=[id]&phone=[phone]`
   - Photo upload widget (drag & drop + file picker)
   - Description textarea
   - Validation: At least 1 photo + description required
   - Preview uploaded images

4. **Create API endpoint**: `/api/fault-reports/create`
   - Upload images to Supabase Storage
   - Create `returns` record with image_urls array
   - Set reason to 'damaged' or 'quality_issue'

5. **Add button to customer profile**:
   - Show "דווח על פגם" button in order history
   - ONLY visible when `delivery_status = 'Picked_up_by_Customer'`
   - Link to fault reporting page

---

### 6. Payment Method Selection in Checkout ⚠️ PARTIAL

**Gap**: Customer checkout page loads payment CONFIG but doesn't let customer SELECT payment method

**Current State**:
- `/customer/checkout` loads `payment_config` from API (lines 85-100)
- Config is based on distributor's `employment_model`
- Customer CANNOT choose between multiple payment methods
- `/order/[distributorId]` page has NO payment method selector at all

**What's Needed**:

1. **For `/customer/checkout` page**:
   - If `employment_model = Credit_Commission`: Show credit card payment only
   - If `employment_model = Cash_Paybox`: Show cash OR Paybox link
   - If `employment_model = Goods_Commission`: Show goods commission message
   - **Add selector if multiple options available** (e.g., Cash vs Paybox)

2. **For `/order/[distributorId]` page** (PUBLIC ORDERS):
   - Add payment method selector (4 buttons):
     - 💳 Credit Card
     - 📱 Bit
     - 📦 Paybox
     - 💵 Cash
   - Insert AFTER customer info, BEFORE order summary
   - Make it REQUIRED field
   - Store selected method in `orders.payment_method`

**Note**: The `/customer/checkout` page already has SOME payment logic, but the `/order/[distributorId]` page (which is more widely used for public orders) has NONE.

---

### 7. Hybrid Pickup Point Selection ❌

**Gap**: Only `/order/[distributorId]` exists (direct link), no distributor selection UI

**Current State**:
- Users must have distributor's direct link
- No way to browse and select distributors
- No confirmation banner when entering via direct link

**What's Needed**:

1. **Create distributor selection page**: `/order` (no distributorId)
   - Show grid of all active distributors
   - Display: Name, location, phone
   - Click → navigate to `/order/[distributorId]`

2. **Detect distributor from URL** in `/order/[distributorId]/page.tsx`:
   - Check if entered via direct link vs referral
   - If direct link: Show confirmation banner
   - Banner message: "אתה מזמין דרך [שם המפיץ] ב-[מיקום]"
   - Include "Change pickup point" button → goes to `/order`

3. **Update distributor links to include query param**:
   - Example: `/order/abc123?ref=direct`
   - Helps track organic vs distributor-referred customers

---

## 📊 IMPLEMENTATION PRIORITY MATRIX

| # | Feature | Status | Priority | Effort | Impact |
|---|---------|--------|----------|--------|--------|
| 1 | Team Leader Refund Permissions | ❌ Missing | 🔴 CRITICAL | 15 min | 🔥 Unblocks team leaders |
| 2 | Settlement Profile in Signup | ❌ Missing | 🔴 HIGH | 2 hours | 🔥 Critical for accounting |
| 3 | Payment Method Selector (Public Orders) | ⚠️ Partial | 🟡 MEDIUM | 45 min | ✅ Completes checkout |
| 4 | Sales Cycle UI Validation | ❌ Missing | 🟡 MEDIUM | 1 hour | ✅ Prevents wrong orders |
| 5 | Customer CRM & Data Persistence | ❌ Missing | 🔴 HIGH | 3 hours | 🔥 Core CRM feature |
| 6 | Fault Reporting with Photos | ❌ Missing | 🟢 LOW | 3 hours | ✅ Quality control |
| 7 | Hybrid Pickup Selection | ❌ Missing | 🟢 LOW | 1.5 hours | ✅ UX improvement |

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Critical Fixes (30 minutes)
**DO THIS FIRST**

1. ✅ **Team Leader RLS Policy** (15 min)
   - Single SQL migration
   - Immediate impact

2. ✅ **Payment Method Selector for Public Orders** (15 min - just UI)
   - Add 4 buttons to `/order/[distributorId]/page.tsx`
   - Store in order (backend already supports it)

---

### Phase 2: High-Impact Features (4-5 hours)
**DO THIS SECOND**

3. ✅ **Settlement Profile in Signup** (2 hours)
   - Update ENUM to 4 values
   - Add dropdown to signup form
   - Create distributor_profile on signup

4. ✅ **Customer CRM System** (3 hours)
   - Modify customers table schema
   - Create lookup API
   - Update order creation
   - Build customer profile page

---

### Phase 3: Medium-Priority Enhancements (2.5 hours)
**DO THIS THIRD**

5. ✅ **Sales Cycle Validation** (1 hour)
   - Add sales cycle check to order pages
   - Show closed/open state
   - Display next cycle date

6. ✅ **Hybrid Pickup Selection** (1.5 hours)
   - Create distributor selection page
   - Add confirmation banner
   - Query param tracking

---

### Phase 4: Quality Control (3 hours)
**DO THIS LAST**

7. ✅ **Fault Reporting with Photos** (3 hours)
   - Set up Supabase Storage
   - Build fault reporting UI
   - Image upload functionality
   - Add button to customer profile

---

## 📋 DATABASE MIGRATIONS NEEDED

### Migration 1: Team Leader Permissions
```sql
-- File: supabase/migrations/20260118000001_team_leader_refunds.sql
DROP POLICY IF EXISTS "Admins can manage returns" ON returns;

CREATE POLICY "Admins and Team Leaders can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'team_leader')
        )
    );
```

### Migration 2: Update Employment Model ENUM
```sql
-- File: supabase/migrations/20260118000002_update_employment_model.sql
ALTER TYPE employment_model ADD VALUE IF NOT EXISTS 'Payslip';
ALTER TYPE employment_model ADD VALUE IF NOT EXISTS 'Private_Business';

COMMENT ON TYPE employment_model IS '4 settlement profiles: Payslip (תלוש), Private_Business (עסק), Cash_Paybox, Goods_Commission (סחורה)';
```

### Migration 3: Customers Table for CRM
```sql
-- File: supabase/migrations/20260118000003_customers_crm.sql

-- Make hub_coordinator_id optional (for public self-service customers)
ALTER TABLE customers
ALTER COLUMN hub_coordinator_id DROP NOT NULL;

-- Add CRM fields
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(12,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS last_order_date TIMESTAMP WITH TIME ZONE;

-- Make phone unique for lookup
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_phone_unique;

ALTER TABLE customers
ADD CONSTRAINT customers_phone_unique UNIQUE (phone);

-- Add customer_id to orders
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

COMMENT ON COLUMN customers.hub_coordinator_id IS 'Optional - NULL for self-service public customers, set for hub-managed customers';
COMMENT ON COLUMN customers.total_orders IS 'Total number of orders placed by this customer';
COMMENT ON COLUMN customers.lifetime_value IS 'Total amount spent by customer across all orders';
```

### Migration 4: Fault Reporting Images
```sql
-- File: supabase/migrations/20260118000004_fault_reporting_images.sql

ALTER TABLE returns
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN returns.image_urls IS 'Array of Supabase Storage URLs for fault report photos';
```

---

## ✅ SUMMARY

### What EXISTS and WORKS:
1. ✅ Full customer checkout flow (`/customer/*`)
2. ✅ Public order page (`/order/[distributorId]`)
3. ✅ Payment config system based on employment_model
4. ✅ Delivery status tracking with `Picked_up_by_Customer`
5. ✅ Comprehensive API layer
6. ✅ Database schema foundation (customers, employment_model, delivery_status)

### What's MISSING:
1. ❌ Settlement profile selection in signup
2. ❌ Sales cycle validation
3. ❌ Team leader refund permissions
4. ❌ Customer CRM with phone lookup
5. ❌ Fault reporting with photos
6. ❌ Payment method selector in public order page
7. ❌ Hybrid pickup point selection

### Total Implementation Time: ~11-12 hours

**Ready to begin implementation!**
