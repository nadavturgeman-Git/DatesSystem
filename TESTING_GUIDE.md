# 🧪 Implementation Testing Guide

**Date**: 2026-01-18
**Server**: http://localhost:3000
**Status**: ✅ Database Verified, Server Running

---

## ✅ Test 1: Database Migrations - PASSED

All database changes verified:
- ✅ Employment Model ENUM: 5 values (Payslip, Private_Business, Cash_Paybox, Goods_Commission, Credit_Commission)
- ✅ Customers Table: CRM fields active
- ✅ Orders Table: customer_id column exists
- ✅ Team Leader RLS Policy: Active

---

## 🔍 Test 2: Settlement Profile Selection in Signup

### Steps:
1. Open http://localhost:3000/signup
2. Fill in the form:
   - Full Name: "Test Distributor"
   - Email: "test-distributor@example.com"
   - Phone: "050-1234567"
   - **Settlement Profile**: Select one of:
     - תלוש משכורת (עובד שכיר)
     - עסק פרטי (עוסק מורשה / חברה)
     - מזומן / Paybox
     - עמלה בסחורה
   - Password: "test1234"
   - Confirm Password: "test1234"
3. Click "הירשם"

### Expected Results:
- ✅ Dropdown shows all 4 settlement profile options
- ✅ Help text appears: "בחר את סוג ההתחשבנות המתאים לסטטוס העסקי שלך..."
- ✅ Validation: Cannot submit without selecting a profile
- ✅ After signup: Redirects to /dashboard
- ✅ No errors in console

### Verification Query:
After signup, check if distributor_profile was created:
```sql
SELECT
  p.email,
  dp.employment_model,
  dp.preferred_payment_method,
  dp.prefers_commission_in_goods
FROM profiles p
LEFT JOIN distributor_profiles dp ON p.id = dp.user_id
WHERE p.email = 'test-distributor@example.com';
```

---

## 🔍 Test 3: Payment Method Selector in Public Order Page

### Steps:
1. First, get a distributor ID:
   - Login to dashboard as admin or distributor
   - Go to http://localhost:3000/dashboard
   - Copy the distributor's public order link OR
   - Find a distributor ID from the database

2. Open public order page:
   - http://localhost:3000/order/[DISTRIBUTOR_ID]
   - Example: http://localhost:3000/order/abc-123-xyz

3. Add products to cart
4. Click "עגלה" button to open checkout modal

### Expected Results in Checkout Modal:
- ✅ Section title: "אמצעי תשלום *"
- ✅ Four payment options displayed:
  - 💳 כרטיס אשראי
  - 📱 Bit
  - 📦 Paybox
  - 💵 מזומן
- ✅ Buttons change color when selected (emerald border + green background)
- ✅ Validation: Cannot submit order without selecting payment method
- ✅ Error message shows: "יש לבחור אמצעי תשלום" if not selected

### Verification:
After creating order, check database:
```sql
SELECT
  order_number,
  payment_method,
  total_amount
FROM orders
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🔍 Test 4: Customer Lookup and Auto-Fill

### Test 4A: First-Time Customer
1. Open http://localhost:3000/order/[DISTRIBUTOR_ID]
2. Add products to cart
3. Open checkout modal
4. Enter phone: "052-9876543" (a phone that doesn't exist yet)
5. Tab out of phone field

**Expected:**
- ✅ No "returning customer" badge appears
- ✅ Name and email fields remain empty
- ✅ Fill all fields manually and submit order

### Test 4B: Returning Customer
1. **After completing Test 4A**, refresh the page
2. Add products to cart again
3. Open checkout modal
4. Enter the SAME phone: "052-9876543"
5. Tab out of phone field OR click on another field

**Expected:**
- ✅ Loading spinner appears briefly in phone field
- ✅ Green checkmark badge appears: "לקוח חוזר - הפרטים הושלמו אוטומטית"
- ✅ Name field auto-fills with "Test Customer" (or whatever name you used)
- ✅ Email field auto-fills if it was provided before
- ✅ Can edit the auto-filled data if needed

### Verification:
Check customer was created and linked:
```sql
-- Check customer record
SELECT
  full_name,
  phone,
  total_orders,
  lifetime_value,
  last_order_date
FROM customers
WHERE phone = '0529876543' -- normalized (no dashes)
LIMIT 1;

-- Check order is linked to customer
SELECT
  o.order_number,
  o.total_amount,
  c.full_name as customer_name,
  c.phone as customer_phone
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
WHERE c.phone = '0529876543'
ORDER BY o.created_at DESC
LIMIT 3;
```

---

## 🔍 Test 5: Team Leader Refund Permissions

### Prerequisites:
- Need a team_leader user account
- If you don't have one, create it in database:

```sql
-- Create team leader profile
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'teamleader@example.com',
  'Test Team Leader',
  'team_leader'
);

-- Set password via Supabase Auth dashboard or create via signup and update role
```

### Steps:
1. **Login as Team Leader**:
   - Email: teamleader@example.com
   - Password: (whatever you set)

2. **Navigate to Returns Page**:
   - Go to http://localhost:3000/admin/returns
   - OR check if "/returns" link appears in navigation

3. **Try to Approve a Return**:
   - If returns exist, try clicking "אישור" button
   - If no returns, create one first via admin

### Expected Results:
- ✅ Team leader can access /admin/returns page (no 403 error)
- ✅ Can see all returns in the list
- ✅ Can click "אישור" button to approve returns
- ✅ No permission denied errors

### Verification:
Check RLS policy allows team_leader:
```sql
SELECT * FROM pg_policies
WHERE tablename = 'returns'
AND policyname LIKE '%Team Leader%';
```

---

## 📊 TEST RESULTS CHECKLIST

Mark each test as you complete it:

- [ ] Test 1: Database Migrations - ✅ **PASSED** (Already Verified)
- [ ] Test 2: Settlement Profile Selection in Signup
  - [ ] Dropdown shows 4 options
  - [ ] Validation works
  - [ ] Signup succeeds
  - [ ] distributor_profile created with correct employment_model
- [ ] Test 3: Payment Method Selector
  - [ ] 4 payment options displayed
  - [ ] Selection works (visual feedback)
  - [ ] Validation enforces selection
  - [ ] payment_method saved to order
- [ ] Test 4A: First-Time Customer
  - [ ] No auto-fill occurs
  - [ ] Order creates customer record
- [ ] Test 4B: Returning Customer
  - [ ] Phone lookup triggers
  - [ ] Auto-fill works
  - [ ] "Returning customer" badge shows
  - [ ] Order links to existing customer
  - [ ] total_orders increments
- [ ] Test 5: Team Leader Permissions
  - [ ] Can access returns page
  - [ ] Can approve returns
  - [ ] No permission errors

---

## 🐛 If Tests Fail - Report Format:

**Test Name**: [Which test failed]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Error Message**: [Any errors in console]
**Screenshot**: [If relevant]

---

## ✅ After Testing:

Once all tests pass, we can:
1. Continue with Phase 3 implementation (Sales Cycle + Pickup Selection)
2. OR fix any bugs found
3. OR deploy what's working

**Server is running at**: http://localhost:3000
**Start testing!** 🚀
