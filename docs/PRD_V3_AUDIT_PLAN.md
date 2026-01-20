# PRD v3.0 Implementation Audit & Plan

**Date**: 2026-01-18
**Status**: Planning Phase - Comprehensive Audit Complete

---

## 📊 AUDIT SUMMARY

| # | Requirement | Status | Implementation Needed |
|---|-------------|--------|----------------------|
| 1 | Distributor Onboarding - Settlement Profile Selection | ❌ **MISSING** | Add mandatory settlement profile selection to signup |
| 2 | Sales Cycle UI - Display Next Cycle Date When Closed | ❌ **MISSING** | Add sales cycle check to customer order page |
| 3 | Expanded Refund Permissions for Team Leaders | ❌ **MISSING** | Update RLS policies to allow team_leader role |
| 4 | Customer Personal Area & Data Persistence | ❌ **MISSING** | Implement localStorage for customer details |
| 5 | Enhanced Fault Reporting with Photo Upload | ❌ **MISSING** | Create fault reporting UI with image upload |
| 6 | Ordering Flow Sequence | ⚠️ **PARTIAL** | Add payment method selection step |

**Overall Completion**: 0/6 fully implemented, 1/6 partially implemented

---

## 🔍 DETAILED FINDINGS

### 1. Distributor Onboarding & Profiles ❌

**Current State**:
- ✅ Database has `employment_model` ENUM with 3 values: `'Credit_Commission'`, `'Cash_Paybox'`, `'Goods_Commission'`
- ✅ `distributor_profiles` table has `employment_model` column
- ✅ Migration `20260113000000_add_missing_prd_fields.sql` exists
- ❌ Signup form does NOT collect settlement profile selection
- ❌ PRD asks for 4 options, but schema only has 3

**Files Reviewed**:
- `src/app/(auth)/signup/page.tsx` (lines 1-267) - No settlement profile selection
- `supabase/migrations/20260113000000_add_missing_prd_fields.sql` (lines 10)
- `supabase-schema.sql` (lines 42-55)

**Gap Analysis**:
The signup form (lines 127-220 in `signup/page.tsx`) only collects:
- Full Name
- Email
- Phone
- Password

It does NOT ask for Settlement Profile.

**PRD Requirement**:
> "Mandatory selection of their Settlement Profile: 1. Payslip (תלוש), 2. Private Business (עסק), 3. Cash/Paybox, 4. Goods Commission (סחורה)"

**Schema vs PRD Mismatch**:
- Schema has: `Credit_Commission`, `Cash_Paybox`, `Goods_Commission` (3 options)
- PRD asks for: Payslip, Private Business, Cash/Paybox, Goods Commission (4 options)
- **Issue**: "Credit_Commission" might need to be split into "Payslip" and "Private Business"

**What Needs to Be Done**:
1. **Update ENUM** (if needed):
   - Consider if `Credit_Commission` should be split into `Payslip` and `Private_Business`
   - OR clarify with user if Credit_Commission covers both

2. **Update Signup Form**:
   - Add mandatory dropdown/radio buttons for settlement profile selection
   - Options: Payslip (תלוש), Private Business (עסק), Cash/Paybox, Goods Commission (סחורה)
   - Map selections to `employment_model` enum values
   - Create `distributor_profile` record during signup with selected employment_model

3. **Database Changes**:
   ```sql
   -- Option A: Keep current 3-value enum
   -- No schema change needed, just map in UI

   -- Option B: Split Credit_Commission into 2 values
   ALTER TYPE employment_model RENAME TO employment_model_old;
   CREATE TYPE employment_model AS ENUM ('Payslip', 'Private_Business', 'Cash_Paybox', 'Goods_Commission');
   ALTER TABLE distributor_profiles
     ALTER COLUMN employment_model TYPE employment_model
     USING employment_model::text::employment_model;
   DROP TYPE employment_model_old;
   ```

---

### 2. Sales Cycle UI Updates ❌

**Current State**:
- ✅ `sales_cycles` table exists with `is_active` boolean
- ✅ Admin can manage sales cycles (`/admin/sales-cycles`)
- ❌ Customer order page does NOT check if sales cycle is closed
- ❌ No "Next Cycle Date" display when cycle is closed

**Files Reviewed**:
- `src/app/order/[distributorId]/page.tsx` (lines 1-400+)
- No sales cycle checks found

**What Needs to Be Done**:
1. **Query Active Sales Cycle**:
   - In `/order/[distributorId]/page.tsx`, fetch active sales cycle
   - Check if `is_active = true`

2. **Conditional UI**:
   - If cycle is closed (`is_active = false`):
     - Hide order form
     - Show message: "מחזור מכירות סגור" (Sales cycle closed)
     - Display: "המחזור הבא מתחיל ב: [next_cycle_date]"
   - If cycle is open:
     - Show normal order form

3. **Code Changes**:
   ```typescript
   // In loadData() function
   const { data: activeCycle } = await supabase
     .from('sales_cycles')
     .select('*')
     .eq('is_active', true)
     .single();

   if (!activeCycle) {
     // Fetch next cycle
     const { data: nextCycle } = await supabase
       .from('sales_cycles')
       .select('*')
       .gt('start_date', new Date().toISOString())
       .order('start_date', { ascending: true })
       .limit(1)
       .single();

     setNextCycleDate(nextCycle?.start_date);
     setCycleClosed(true);
   }
   ```

---

### 3. Expanded Refund Permissions ❌

**Current State**:
- ✅ Returns management UI exists (`/admin/returns/page.tsx`)
- ✅ `approveReturn()` function exists (line 88)
- ❌ RLS policies ONLY allow `admin` role to manage returns
- ❌ Team leaders cannot approve refunds

**Files Reviewed**:
- `supabase-schema.sql` (lines 666-672) - RLS policies for returns
- `src/app/(dashboard)/admin/returns/page.tsx` (lines 88-107)

**Current RLS Policy**:
```sql
CREATE POLICY "Admins can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
```

**What Needs to Be Done**:
1. **Update RLS Policy**:
   ```sql
   -- Drop existing policy
   DROP POLICY IF EXISTS "Admins can manage returns" ON returns;

   -- Create new policy allowing both admin and team_leader
   CREATE POLICY "Admins and Team Leaders can manage returns" ON returns
       FOR ALL USING (
           EXISTS (
               SELECT 1 FROM profiles
               WHERE id = auth.uid()
               AND role IN ('admin', 'team_leader')
           )
       );
   ```

2. **Verify UI Permissions**:
   - Check if `/admin/returns` page is accessible to team_leaders
   - Update navigation to show Returns link for team_leader role

3. **Create Migration File**:
   - File: `supabase/migrations/20260118000000_team_leader_refund_permissions.sql`

---

### 4. Customer Personal Area & Data Persistence ❌

**Current State**:
- ✅ Customer order form collects: full_name, phone, email
- ❌ No localStorage persistence
- ❌ No customer profile/personal area
- ❌ Customers must re-enter details every time

**Files Reviewed**:
- `src/app/order/[distributorId]/page.tsx` (lines 37-41, 326-362)
- No persistence mechanism found

**Current Code** (lines 37-41):
```typescript
const [customerInfo, setCustomerInfo] = useState({
  full_name: '',
  phone: '',
  email: '',
})
```

**What Needs to Be Done**:

**Option A: Simple localStorage (Recommended for MVP)**
```typescript
// On component mount - load from localStorage
useEffect(() => {
  const savedCustomerInfo = localStorage.getItem('customerInfo')
  if (savedCustomerInfo) {
    try {
      const parsed = JSON.parse(savedCustomerInfo)
      setCustomerInfo(parsed)
    } catch (e) {
      console.error('Error loading customer info:', e)
    }
  }
}, [])

// On form change - save to localStorage
function updateCustomerInfo(field: string, value: string) {
  const updated = { ...customerInfo, [field]: value }
  setCustomerInfo(updated)
  localStorage.setItem('customerInfo', JSON.stringify(updated))
}
```

**Option B: Database Customer Profiles (More robust)**
1. **Create `customers` table** (if not exists):
   ```sql
   CREATE TABLE IF NOT EXISTS customers (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     phone VARCHAR(20) NOT NULL UNIQUE, -- Use phone as unique identifier
     full_name VARCHAR(255) NOT NULL,
     email VARCHAR(255),
     address TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **Lookup customer by phone**:
   ```typescript
   async function lookupCustomer(phone: string) {
     const { data } = await fetch('/api/customers/lookup', {
       method: 'POST',
       body: JSON.stringify({ phone })
     })
     if (data?.customer) {
       setCustomerInfo(data.customer)
     }
   }
   ```

**Recommendation**: Start with localStorage (simpler, faster to implement), then upgrade to database if needed.

---

### 5. Enhanced Fault Reporting System ❌

**Current State**:
- ✅ `returns` table exists with reason types: `'damaged'`, `'quality_issue'`
- ❌ No customer-facing fault reporting UI
- ❌ No photo upload functionality
- ❌ No mandatory photo + description requirement

**Files Reviewed**:
- No fault reporting interface found in `/src/app/order/` or `/src/app/(customer)/`
- `returns` table exists but no public API endpoint

**What Needs to Be Done**:

1. **Database Schema Update**:
   ```sql
   -- Add image_urls column to returns table
   ALTER TABLE returns
   ADD COLUMN IF NOT EXISTS image_urls TEXT[]; -- Array of image URLs

   -- Make description NOT NULL for customer-reported faults
   -- (Keep nullable for admin-created returns)
   ```

2. **Create Fault Reporting UI**:
   - **New Page**: `src/app/(customer)/report-fault/[orderId]/page.tsx`
   - Or add "דווח על פגם" button in order confirmation page

3. **Image Upload Implementation**:
   - Use Supabase Storage for images
   - Create bucket: `fault-reports`
   - Upload flow:
     ```typescript
     async function uploadFaultImages(files: File[]) {
       const urls = []
       for (const file of files) {
         const fileName = `${orderId}_${Date.now()}_${file.name}`
         const { data } = await supabase.storage
           .from('fault-reports')
           .upload(fileName, file)
         if (data) {
           const { data: { publicUrl } } = supabase.storage
             .from('fault-reports')
             .getPublicUrl(fileName)
           urls.push(publicUrl)
         }
       }
       return urls
     }
     ```

4. **Form Validation**:
   ```typescript
   function validateFaultReport() {
     if (!description || description.trim() === '') {
       setError('יש להזין תיאור הבעיה')
       return false
     }
     if (!images || images.length === 0) {
       setError('יש להעלות לפחות תמונה אחת')
       return false
     }
     return true
   }
   ```

5. **API Endpoint**:
   - **New File**: `src/app/api/fault-reports/create/route.ts`
   - Accepts: orderId, description, image_urls[]
   - Creates return record with reason='damaged' or 'quality_issue'

6. **UI Components Needed**:
   - Image upload widget (drag & drop + file picker)
   - Image preview
   - Text area for description
   - Submit button (disabled until photo + description provided)

**Hebrew Labels**:
- Button: "דיווח על פרי פגום"
- Title: "דיווח על פגם במוצר"
- Photo label: "תמונות (חובה)"
- Description label: "תיאור הבעיה (חובה)"
- Submit: "שלח דיווח"

---

### 6. Ordering Flow Nuances ⚠️ PARTIAL

**Current State**:
- ✅ Product selection works (product grid)
- ✅ Pickup point is associated with distributor (URL-based: `/order/[distributorId]`)
- ❌ NO payment method selection in customer flow
- ⚠️ Pickup point selection is implicit (URL), not an explicit step

**Files Reviewed**:
- `src/app/order/[distributorId]/page.tsx` (lines 296-400) - Checkout modal
- Checkout shows: Order summary → Customer info → Distributor info → Submit
- NO payment method selector

**Current Flow**:
1. ✅ User navigates to `/order/[distributorId]` (pickup point determined)
2. ✅ Product selection (add to cart)
3. ✅ Checkout modal opens
4. ✅ Customer fills contact info (name, phone, email)
5. ✅ Distributor/pickup point shown
6. ❌ **MISSING**: Payment method selection
7. ✅ Submit order

**PRD Required Flow**:
> "Product selection → Pickup point selection (associated with a Distributor) → Payment method selection"

**What Needs to Be Done**:

1. **Add Payment Method Selection**:
   ```typescript
   const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'bit' | 'paybox' | 'cash' | null>(null)
   ```

2. **UI Addition** (insert after customer info, before distributor info):
   ```tsx
   {/* Payment Method Selection */}
   <div className="mb-6">
     <h3 className="text-lg font-semibold text-gray-900 mb-4">אמצעי תשלום</h3>
     <div className="grid grid-cols-2 gap-3">
       <button
         onClick={() => setPaymentMethod('credit_card')}
         className={`p-4 border-2 rounded-lg text-center ${
           paymentMethod === 'credit_card'
             ? 'border-emerald-600 bg-emerald-50'
             : 'border-gray-300'
         }`}
       >
         💳 כרטיס אשראי
       </button>
       <button
         onClick={() => setPaymentMethod('bit')}
         className={`p-4 border-2 rounded-lg text-center ${
           paymentMethod === 'bit'
             ? 'border-emerald-600 bg-emerald-50'
             : 'border-gray-300'
         }`}
       >
         📱 Bit
       </button>
       <button
         onClick={() => setPaymentMethod('paybox')}
         className={`p-4 border-2 rounded-lg text-center ${
           paymentMethod === 'paybox'
             ? 'border-emerald-600 bg-emerald-50'
             : 'border-gray-300'
         }`}
       >
         📦 Paybox
       </button>
       <button
         onClick={() => setPaymentMethod('cash')}
         className={`p-4 border-2 rounded-lg text-center ${
           paymentMethod === 'cash'
             ? 'border-emerald-600 bg-emerald-50'
             : 'border-gray-300'
         }`}
       >
         💵 מזומן
       </button>
     </div>
   </div>
   ```

3. **Validation**:
   ```typescript
   function handleSubmitOrder() {
     if (!paymentMethod) {
       setError('יש לבחור אמצעי תשלום')
       return
     }
     // ... rest of submit logic
   }
   ```

4. **API Update**:
   - Send `payment_method` in order creation request
   - Store in `orders` table

**Optional Enhancement - Explicit Pickup Point Selection**:
If user wants customers to explicitly choose pickup point:
1. Create distributor/hub selection page: `/order/new`
2. Show list of distributors with locations
3. Customer selects distributor
4. Redirect to `/order/[selectedDistributorId]`

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Quick Wins (2-3 hours)
**Priority: HIGH - Immediate User-Facing Impact**

1. **Requirement 3: Team Leader Refund Permissions** (15 min)
   - Update RLS policy
   - Test with team_leader account
   - ✅ DONE indicator: Team leader can approve returns

2. **Requirement 4: Customer Data Persistence** (30 min)
   - Add localStorage save/load
   - Test form auto-fill
   - ✅ DONE indicator: Returning customers see pre-filled info

3. **Requirement 6: Payment Method Selection** (45 min)
   - Add payment method selector to checkout
   - Update API to accept payment_method
   - ✅ DONE indicator: Orders include selected payment method

4. **Requirement 2: Sales Cycle UI** (1 hour)
   - Add sales cycle check to order page
   - Show "Next Cycle Date" when closed
   - ✅ DONE indicator: Closed cycles hide order form

**Total Phase 1**: ~2.5 hours

---

### Phase 2: Settlement Profile (2-3 hours)
**Priority: HIGH - Critical for Onboarding**

1. **Requirement 1: Distributor Onboarding** (2-3 hours)
   - **Step 1**: Clarify ENUM values with user (5 min)
   - **Step 2**: Update signup form UI (1 hour)
     - Add settlement profile dropdown
     - Hebrew labels
     - Validation
   - **Step 3**: Update signup logic (30 min)
     - Create distributor_profile record
     - Set employment_model
   - **Step 4**: Database migration if needed (15 min)
   - **Step 5**: Test signup flow (15 min)
   - ✅ DONE indicator: New distributors select settlement profile during signup

**Total Phase 2**: ~2.5 hours

---

### Phase 3: Fault Reporting (3-4 hours)
**Priority: MEDIUM - Important but Complex**

1. **Requirement 5: Enhanced Fault Reporting** (3-4 hours)
   - **Step 1**: Set up Supabase Storage bucket (15 min)
   - **Step 2**: Update database schema (15 min)
     - Add image_urls column
     - Migration file
   - **Step 3**: Create fault reporting UI (2 hours)
     - Page component
     - Image upload widget
     - Form validation
   - **Step 4**: Create API endpoint (30 min)
   - **Step 5**: Add "Report Fault" button to order confirmation (15 min)
   - **Step 6**: Test image upload and submission (30 min)
   - ✅ DONE indicator: Customers can report faults with photos

**Total Phase 3**: ~3.5 hours

---

## 📝 DATABASE SCHEMA CHANGES NEEDED

### 1. Returns Table - Add Image URLs
```sql
-- Migration: Add image support to returns table
ALTER TABLE returns
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN returns.image_urls IS 'Array of Supabase Storage URLs for fault report images';
```

### 2. RLS Policy - Team Leader Permissions
```sql
-- Migration: Allow team leaders to manage returns
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

### 3. Employment Model ENUM (If needed)
```sql
-- Migration: Update employment_model ENUM
-- Only needed if splitting Credit_Commission into Payslip + Private_Business

-- Option A: Add new values to existing enum
ALTER TYPE employment_model ADD VALUE IF NOT EXISTS 'Payslip';
ALTER TYPE employment_model ADD VALUE IF NOT EXISTS 'Private_Business';

-- Option B: Replace enum entirely
ALTER TYPE employment_model RENAME TO employment_model_old;
CREATE TYPE employment_model AS ENUM ('Payslip', 'Private_Business', 'Cash_Paybox', 'Goods_Commission');

ALTER TABLE distributor_profiles
  ALTER COLUMN employment_model TYPE employment_model
  USING CASE
    WHEN employment_model_old = 'Credit_Commission' THEN 'Payslip'::employment_model
    WHEN employment_model_old = 'Cash_Paybox' THEN 'Cash_Paybox'::employment_model
    WHEN employment_model_old = 'Goods_Commission' THEN 'Goods_Commission'::employment_model
  END;

DROP TYPE employment_model_old;
```

### 4. Customers Table (If using DB persistence)
```sql
-- Migration: Create customers table for personal area
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own data" ON customers
    FOR SELECT USING (phone = current_setting('request.jwt.claims')::json->>'phone');

CREATE POLICY "Public can create customer profile" ON customers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Customers can update own data" ON customers
    FOR UPDATE USING (phone = current_setting('request.jwt.claims')::json->>'phone');
```

---

## 🚀 IMPLEMENTATION ORDER RECOMMENDATION

### Recommended Sequence:
1. **Team Leader Refund Permissions** (15 min) - Quickest win, unblocks team leaders
2. **Customer Data Persistence** (30 min) - Immediate UX improvement
3. **Payment Method Selection** (45 min) - Complete checkout flow
4. **Sales Cycle UI** (1 hour) - Prevent orders during closed cycles
5. **Settlement Profile Selection** (2-3 hours) - Critical onboarding fix
6. **Fault Reporting** (3-4 hours) - More complex, lower priority

**Total Time**: ~8-10 hours for all 6 requirements

---

## ✅ USER DECISIONS

1. **Settlement Profile ENUM**: ✅ **SPLIT INTO 4 OPTIONS**
   - Decision: Create 4 separate options: Payslip (תלוש), Private Business (עסק), Cash/Paybox, Goods Commission (סחורה)
   - Reason: Crucial for accounting and tax reporting
   - Action: Update database ENUM and all related logic

2. **Customer Personal Area**: ✅ **DATABASE CUSTOMER PROFILES**
   - Decision: Implement full customer table with CRM features
   - Reason: Admin needs customer history, lifetime value tracking, and client base management
   - Features: Phone number as lookup key, cross-device persistence, professional CRM approach

3. **Fault Reporting Timing**: ✅ **ORDER HISTORY (PICKED UP ONLY)**
   - Decision: Place "Report Fault" button in Order History section of Customer Profile
   - Critical Logic: Button only visible for orders with status `Picked_up_by_Customer`
   - Reason: Customers only discover faults after pickup and inspection
   - Additional: Generate direct link for post-pickup follow-up messages

4. **Pickup Point Selection**: ✅ **HYBRID APPROACH**
   - Decision: Support both URL-based (with confirmation) AND explicit selection
   - Direct Link Entry: Detect `?dist=123` in URL, auto-select distributor, show confirmation message
   - Organic Entry: If no distributor in URL, show explicit selection step with all active distributors
   - Reason: Supports distributors as active marketers while remaining accessible to new customers

---

## 🎯 UPDATED IMPLEMENTATION PLAN (Based on User Decisions)

### Phase 1: Database Schema Updates (1 hour)
**Priority: CRITICAL - Must be done first**

1. ✅ **Create `employment_model_v2` ENUM with 4 values** (15 min)
   - Values: `'Payslip'`, `'Private_Business'`, `'Cash_Paybox'`, `'Goods_Commission'`
   - Migration file: `20260118000001_update_employment_model.sql`

2. ✅ **Create `customers` table with CRM fields** (20 min)
   - Columns: id, phone (unique), full_name, email, address, city, total_orders, lifetime_value
   - RLS policies for customer access and admin management
   - Migration file: `20260118000002_create_customers_table.sql`

3. ✅ **Update `orders` table** (10 min)
   - Add `customer_id UUID REFERENCES customers(id)`
   - Update order_status ENUM to include `'Picked_up_by_Customer'`
   - Migration file: `20260118000003_update_orders_for_customers.sql`

4. ✅ **Update RLS policies for team leader refunds** (5 min)
   - Allow `role IN ('admin', 'team_leader')` for returns management
   - Migration file: `20260118000004_team_leader_refund_permissions.sql`

5. ✅ **Add `image_urls` to returns table** (5 min)
   - Column: `image_urls TEXT[]`
   - Migration file: `20260118000005_add_returns_images.sql`

6. ✅ **Create Supabase Storage bucket** (5 min)
   - Bucket: `fault-reports`
   - Public read access

---

### Phase 2: Distributor Onboarding (1.5 hours)
**Priority: HIGH - Unblocks new distributor registration**

1. ✅ **Update signup form UI** (45 min)
   - Add settlement profile dropdown with 4 options
   - Hebrew labels: תלוש (Payslip), עסק (Private Business), מזומן/Paybox, סחורה (Goods)
   - Validation: Required field
   - File: `src/app/(auth)/signup/page.tsx`

2. ✅ **Update signup logic** (30 min)
   - Create `distributor_profile` record with selected `employment_model`
   - Handle Google OAuth signup to prompt for settlement profile
   - File: `src/app/(auth)/signup/page.tsx`

3. ✅ **Test signup flow** (15 min)
   - Create test distributor with each settlement profile option
   - Verify `distributor_profiles.employment_model` is set correctly

---

### Phase 3: Customer CRM & Data Persistence (2 hours)
**Priority: HIGH - Core feature for customer experience**

1. ✅ **Create customer lookup API** (30 min)
   - Endpoint: `/api/customers/lookup`
   - Input: phone number
   - Output: customer profile or null
   - Auto-create customer on first order
   - File: `src/app/api/customers/lookup/route.ts`

2. ✅ **Update order page with customer lookup** (45 min)
   - On phone number change, lookup customer
   - Auto-fill name, email, address if found
   - Show "Returning customer" badge
   - File: `src/app/order/[distributorId]/page.tsx`

3. ✅ **Create customer profile page** (30 min)
   - Route: `/customer/profile?phone=[phone]`
   - Show: Order history, total orders, lifetime value
   - File: `src/app/(customer)/profile/page.tsx`

4. ✅ **Update order creation to link customer** (15 min)
   - Create or fetch customer record by phone
   - Link order to customer_id
   - Update customer lifetime_value and total_orders
   - File: `src/app/api/orders/create-public/route.ts`

---

### Phase 4: Sales Cycle UI (1 hour)
**Priority: MEDIUM - Prevents orders during closed cycles**

1. ✅ **Query active sales cycle** (20 min)
   - Fetch from `sales_cycles` where `is_active = true`
   - If none, fetch next cycle by start_date
   - File: `src/app/order/[distributorId]/page.tsx`

2. ✅ **Conditional UI rendering** (30 min)
   - If cycle closed: Hide product grid, show message + next cycle date
   - If cycle open: Show normal order form
   - File: `src/app/order/[distributorId]/page.tsx`

3. ✅ **Test with closed cycle** (10 min)
   - Set all cycles to `is_active = false`
   - Verify customer sees "Sales cycle closed" message

---

### Phase 5: Hybrid Pickup Point Selection (1.5 hours)
**Priority: MEDIUM - Improves UX for organic traffic**

1. ✅ **Detect distributor from URL** (30 min)
   - Check for `?dist=[id]` query parameter
   - If found: Pre-select distributor, show confirmation banner
   - If not found: Show distributor selection UI
   - File: `src/app/order/[distributorId]/page.tsx`

2. ✅ **Create distributor selection UI** (45 min)
   - Route: `/order` (no distributorId)
   - Show grid of all active distributors
   - Display: Name, location, phone
   - Click → navigate to `/order/[distributorId]`
   - File: `src/app/order/page.tsx`

3. ✅ **Add confirmation banner** (15 min)
   - Show when entering via direct link
   - Message: "אתה מזמין דרך [שם המפיץ] ב-[מיקום]"
   - Include "Change pickup point" button
   - File: `src/app/order/[distributorId]/page.tsx`

---

### Phase 6: Payment Method Selection (45 min)
**Priority: MEDIUM - Completes checkout flow**

1. ✅ **Add payment method state** (15 min)
   - State: `paymentMethod: 'credit_card' | 'bit' | 'paybox' | 'cash' | null`
   - File: `src/app/order/[distributorId]/page.tsx`

2. ✅ **Create payment method selector UI** (20 min)
   - 4 buttons: Credit Card (💳), Bit (📱), Paybox (📦), Cash (💵)
   - Insert after customer info, before distributor info
   - Validation: Required field
   - File: `src/app/order/[distributorId]/page.tsx`

3. ✅ **Update order creation API** (10 min)
   - Accept `payment_method` in request body
   - Store in `orders.payment_method`
   - File: `src/app/api/orders/create-public/route.ts`

---

### Phase 7: Fault Reporting with Photos (3 hours)
**Priority: MEDIUM - Important for quality control**

1. ✅ **Create fault reporting UI** (1.5 hours)
   - Route: `/customer/report-fault?orderId=[id]`
   - UI: Photo upload widget (drag & drop + file picker), description textarea
   - Validation: At least 1 photo + description required
   - Preview uploaded images
   - File: `src/app/(customer)/report-fault/page.tsx`

2. ✅ **Implement image upload** (45 min)
   - Upload to Supabase Storage `fault-reports` bucket
   - Generate public URLs
   - Handle multiple images (max 5)
   - Show upload progress
   - File: `src/app/(customer)/report-fault/page.tsx`

3. ✅ **Create fault report API** (30 min)
   - Endpoint: `/api/fault-reports/create`
   - Input: orderId, description, image_urls[]
   - Create return record with reason='damaged'
   - Send to admin for approval
   - File: `src/app/api/fault-reports/create/route.ts`

4. ✅ **Add button to customer profile** (15 min)
   - Show "דווח על פגם" button in order history
   - Only visible for orders with status `Picked_up_by_Customer`
   - Link to fault reporting page with orderId
   - File: `src/app/(customer)/profile/page.tsx`

---

## 📊 IMPLEMENTATION SUMMARY

| Phase | Priority | Time Estimate | Dependencies |
|-------|----------|--------------|--------------|
| 1. Database Schema Updates | CRITICAL | 1 hour | None (do first) |
| 2. Distributor Onboarding | HIGH | 1.5 hours | Phase 1 complete |
| 3. Customer CRM | HIGH | 2 hours | Phase 1 complete |
| 4. Sales Cycle UI | MEDIUM | 1 hour | None |
| 5. Hybrid Pickup Selection | MEDIUM | 1.5 hours | Phase 3 (customer lookup) |
| 6. Payment Method Selection | MEDIUM | 45 min | None |
| 7. Fault Reporting | MEDIUM | 3 hours | Phase 1, Phase 3 |

**Total Estimated Time**: ~11 hours

**Recommended Order**:
1. Phase 1 (Database) - 1 hour
2. Phase 2 (Onboarding) - 1.5 hours
3. Phase 3 (Customer CRM) - 2 hours
4. Phase 6 (Payment Method) - 45 min
5. Phase 4 (Sales Cycle) - 1 hour
6. Phase 5 (Pickup Selection) - 1.5 hours
7. Phase 7 (Fault Reporting) - 3 hours

---

## ✅ NEXT STEPS

1. ✅ **User Decisions Recorded**
2. ✅ **Implementation Plan Updated**
3. ⏳ **Exit Plan Mode & Get Approval**
4. ⏳ **Begin Implementation** - Start with Phase 1 (Database Schema)

---

**Plan Status**: ✅ READY FOR IMPLEMENTATION
