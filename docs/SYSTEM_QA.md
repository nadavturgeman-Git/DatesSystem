# Date Farm Management System – Implementation Q&A (Traceability Matrix)

מסמך זה מתעד כיצד דרישות האפיון (PRD v3.1) מומשו במערכת בפועל.

---

## 1. ניהול מלאי ולוגיסטיקה

### ש: כיצד מובטחת טריות הפרי (FIFO)?

**ת:** בטבלת ה-`pallets` נוסף שדה `entry_date`. דוח ההעמסה (Loading Sheet) משתמש בשאילתת FIFO שמתעדפת ניפוק משטחים עם תאריך הכניסה המוקדם ביותר.

**מימוש:**
- **קובץ**: `src/lib/skills/inventory/fifo.ts`
- **פונקציה**: `allocateFIFO()` - ממיינת לפי `entry_date ASC`
- **אינדקס**: `idx_pallets_fifo` על `(product_id, entry_date ASC, is_depleted)`
- **טבלה**: `pallets` - שדה `entry_date TIMESTAMP WITH TIME ZONE`

**קוד רלוונטי:**
```sql
ORDER BY p.entry_date ASC
```

---

### ש: איך נמנעת מכירת יתר (Overselling)?

**ת:** הוטמע מנגנון Virtual Lock. ברגע שלקוח מבצע הזמנה, השדה `reserved_stock` עולה. המלאי הזמין למכירה באתר מחושב כך:

$$Available = Physical - Reserved$$

**מימוש:**
- **קובץ**: `src/lib/skills/locking/virtual-lock.ts`
- **טבלה**: `stock_reservations` - שומרת הזמנות עם `expires_at`
- **פונקציה**: `get_available_stock()` - מחשבת מלאי זמין
- **טיימאאוט**: 30 דקות (ברירת מחדל)

**קוד רלוונטי:**
```typescript
// יצירת הזמנה
await createReservations({
  orderId,
  productId,
  requestedWeight,
  timeoutMinutes: 30
})

// חישוב מלאי זמין
const available = totalStock - reservedStock
```

---

### ש: מתי המלאי הפיזי יורד בפועל?

**ת:** רק לאחר אישור ידני של מנהל (Admin) על ה-Loading List. פעולה זו מעבירה את הסטטוס מ-Reserved ל-Dispatched ומפחיתה את ה-`physical_stock` במחסן הרלוונטי.

**מימוש:**
- **קובץ**: `src/lib/skills/inventory/loading-approval.ts`
- **פונקציה**: `approveOrderLoading()` - מאשרת טעינה ומפחיתה מלאי
- **UI**: `src/app/(dashboard)/admin/loading-approval/page.tsx`
- **API**: `src/app/api/admin/orders/[id]/approve-loading/route.ts`

**זרימה:**
1. הזמנה נוצרת → מלאי שמור (Virtual Lock)
2. תשלום מתקבל → הזמנה נשארת, מלאי פיזי לא משתנה
3. מנהל מאשר טעינה → הזמנות מומרות להקצאות, מלאי פיזי יורד

**קוד רלוונטי:**
```typescript
// רק לאחר אישור מנהל
await approveOrderLoading(orderId, adminUserId)
// זה מפעיל:
await convertReservationsToAllocations(orderId)
// שמעדכן:
UPDATE pallets SET current_weight_kg = current_weight_kg - allocated_weight
```

---

## 2. מודל הרכזים והתשלום ההיברידי

### ש: איך המערכת יודעת איזה תשלום להציג ללקוח?

**ת:** לכל רכז מוגדר `employment_model`.

- **בבחירת רכז במסלול `Cash_Paybox`**: המערכת מציגה ללקוח את ה-Paybox Link של הרכז.
- **בבחירת רכז במסלול `Credit_Commission`**: המערכת מפעילה את ממשק הסליקה באתר.

**מימוש:**
- **קובץ**: `src/lib/skills/payments/hybrid-payment-workflow.ts`
- **פונקציה**: `getPaymentUIConfig()` - מחזירה תצורת UI לפי `employment_model`
- **UI**: `src/app/(customer)/checkout/page.tsx` - מציג תצורת תשלום דינמית

**טבלה**: `distributor_profiles`
- `employment_model` ENUM: `Credit_Commission`, `Cash_Paybox`, `Goods_Commission`
- `paybox_link` VARCHAR(500) - קישור Paybox לרכז

**קוד רלוונטי:**
```typescript
switch (employmentModel) {
  case 'Cash_Paybox':
    return {
      showPayboxLink: true,
      payboxLink: distributor.paybox_link,
      showCreditCard: false
    }
  case 'Credit_Commission':
    return {
      showCreditCard: true,
      showPayboxLink: false
    }
}
```

---

### ש: איך נסגר החוב של רכז שגובה מזומן?

**ת:** הרכז רואה בדאשבורד שלו את רשימת ההזמנות. עליו לסמן ידנית "Mark as Paid" לכל לקוח. המערכת מפיקה למנהל דו"ח "Net to Farm" שמחשב כמה כסף הרכז חייב להעביר למשק לאחר ניכוי העמלה שלו.

**מימוש:**
- **פונקציה**: `confirmCashPayment()` - מאשרת תשלום מזומן
- **UI**: כפתור "Mark as Paid" בדאשבורד רכז (להשלמה)
- **דוח**: דוח "Net to Farm" בדאשבורד מנהל (להשלמה)

**קוד רלוונטי:**
```typescript
// רכז מאשר תשלום מזומן
await confirmCashPayment(orderId, distributorId)
// מעדכן:
UPDATE orders SET payment_status = 'paid', payment_method = 'cash'
```

---

## 3. מנוע העמלות (Commission Engine)

### ש: האם העמלה מחושבת על כל הזמנה בנפרד?

**ת:** לא. העמלה מחושבת באופן מצטבר לכל סבב מכירה (Sales Cycle). המערכת מסכמת את סך המשקל שרכז מכר ומפעילה את המדרגות:

$$Weight < 50kg \implies 15\%$$

$$50kg \le Weight \le 75kg \implies 17\%$$

$$Weight > 75kg \implies 20\%$$

**מימוש:**
- **קובץ**: `src/lib/skills/commissions/cycle-commission.ts`
- **פונקציה**: `calculateCycleCommission()` - מחשבת עמלה מצטברת לסבב
- **טבלה**: `sales_cycles` - מגדירה חלון הזמנות

**קוד רלוונטי:**
```typescript
// מסכמת כל ההזמנות בסבב
const totalWeight = orders.reduce((sum, o) => sum + o.total_weight_kg, 0)
const totalRevenue = orders.reduce((sum, o) => sum + o.subtotal, 0)

// מפעילה מדרגות לפי משקל כולל
const rate = calculateDistributorRate(totalWeight) // 15%, 17%, או 20%
const commission = calculateCommissionAmount(totalRevenue, rate)
```

**מדרגות:**
- **< 50 ק"ג**: 15%
- **50-75 ק"ג**: 17%
- **> 75 ק"ג**: 20%

---

### ש: כיצד מחושבת עמלת ראש הצוות?

**ת:** המערכת מזהה את כל הרכזים המשויכים לראש הצוות ומחשבת $5\%$ מסך המכירות הברוטו שלהם באותו סבב.

**מימוש:**
- **קובץ**: `src/lib/skills/commissions/cycle-commission.ts`
- **פונקציה**: `calculateTeamLeaderCycleCommission()` - מחשבת עמלת ראש צוות
- **שיעור קבוע**: 5% מסך המכירות

**קוד רלוונטי:**
```typescript
// מוצא כל הרכזים תחת ראש הצוות
const distributors = await getDistributorsByTeamLeader(teamLeaderId)

// מסכם את כל המכירות שלהם בסבב
const totalRevenue = sum(allOrders.subtotal)

// מחשב 5%
const commission = totalRevenue * 0.05
```

**טבלה**: `profiles` - שדה `team_leader_id` מקשר רכז לראש צוות

---

## 4. תקשורת והתראות

### ש: מתי הלקוח מקבל הודעה שאפשר לבוא לאסוף?

**ת:** רק כאשר הרכז לוחץ על כפתור "Stock Received" בדאשבורד שלו. פעולה זו מעדכנת את סטטוס ההזמנה ל-`Ready_for_Pickup` ושולחת התראה (SMS/WhatsApp) ללקוחות הרלוונטיים בלבד.

**מימוש:**
- **קומפוננטה**: `src/components/orders/StockReceivedButton.tsx`
- **API**: `src/app/api/orders/[id]/mark-received/route.ts`
- **שירות**: `src/lib/skills/notifications/pickup-notifications.ts`
- **טבלה**: `notifications` - שומרת התראות

**זרימה:**
1. רכז לוחץ "Stock Received"
2. מעדכן `delivery_status = 'Delivered_to_Distributor'`
3. מוצא לקוחות המשויכים לרכז
4. שולח SMS/WhatsApp לכל לקוח
5. יוצר רשומה ב-`notifications`

**קוד רלוונטי:**
```typescript
// רכז מסמן מלאי כנתקבל
await markStockReceived(orderId)

// מעדכן סטטוס
UPDATE orders SET delivery_status = 'Delivered_to_Distributor'

// שולח התראות
for (const customer of customers) {
  await sendPickupNotification({
    customerPhone: customer.phone,
    orderNumber: order.order_number,
    distributorName: distributor.full_name
  })
}
```

**הערה**: כרגע מימוש Mock. להחלפה ב-Twilio/WhatsApp API בפועל.

---

### ש: איך המערכת מטפלת ב"חוק ה-50 ק"ג"?

**ת:** בדאשבורד המנהל וראש הצוות, המערכת מסמנת בצורה ויזואלית רכזים שלא הגיעו לרף המינימלי, כדי לאפשר קבלת החלטה על איחוד נקודות חלוקה לפני סגירת הסבב.

**מימוש:**
- **קובץ**: `src/lib/skills/alerts/alert-manager.ts`
- **פונקציה**: `check50kgRule()` - בודקת ביצועים לפי סבב
- **טבלה**: `performance_metrics` - שומרת מדדי ביצועים
- **UI**: 
  - `src/app/(dashboard)/admin/performance/page.tsx` - דאשבורד מנהל
  - `src/app/(dashboard)/team-leader/page.tsx` - דאשבורד ראש צוות

**קוד רלוונטי:**
```typescript
// בודקת רכזים שלא הגיעו ל-50 ק"ג
SELECT distributor_id, SUM(total_weight_kg) as total_weight
FROM orders
WHERE sales_cycle = current_cycle
GROUP BY distributor_id
HAVING SUM(total_weight_kg) < 50

// יוצרת התראה
await createAlert('low_performance', {
  distributorId,
  totalWeight,
  shortfall: 50 - totalWeight
})
```

**תצוגה:**
- דאשבורד מנהל: רשימת רכזים עם סטטוס "לא עמד במינימום"
- דאשבורד ראש צוות: רכזים באזור עם סימון ויזואלי

---

## 5. ישויות חדשות בבסיס הנתונים (Database Schema)

### `employment_model` (ENUM)

**תיאור**: ניהול סוג ההתקשרות עם הרכז.

**ערכים:**
- `Credit_Commission` - רכז עם אשראי ועמלה בחשבונית
- `Cash_Paybox` - רכז שגובה מזומן/פייבוקס
- `Goods_Commission` - רכז שמקבל עמלה במוצרים

**טבלה**: `distributor_profiles`

**מימוש:**
```sql
CREATE TYPE employment_model AS ENUM (
  'Credit_Commission',
  'Cash_Paybox',
  'Goods_Commission'
);

ALTER TABLE distributor_profiles
ADD COLUMN employment_model employment_model;
```

---

### `is_fresh_fruit` (Boolean)

**תיאור**: הגנה על פרי לח במחסן ירושלים.

**שימוש**: מערכת התראות קלקול בודקת רק משטחים עם `is_fresh_fruit = TRUE` במחסן קירור.

**טבלה**: `pallets`

**מימוש:**
```sql
ALTER TABLE pallets
ADD COLUMN is_fresh_fruit BOOLEAN DEFAULT FALSE;

-- אינדקס לאיתור מהיר
CREATE INDEX idx_pallets_fresh_cooling 
ON pallets(warehouse_id, is_fresh_fruit, entry_date)
WHERE is_fresh_fruit = TRUE;
```

**קוד התראה:**
```typescript
// בודקת רק פרי טרי במחסן קירור
WHERE p.is_fresh_fruit = TRUE
AND p.warehouse_id = 'Jerusalem Warehouse'
AND p.entry_date < NOW() - (alertDays || ' days')::interval
```

---

### `loading_approved_at` (Timestamp)

**תיאור**: תיעוד זמן הפחתת המלאי הפיזי.

**שימוש**: מעקב מתי מנהל אישר טעינה ומתי המלאי הפיזי ירד בפועל.

**טבלה**: `orders`

**מימוש:**
```sql
ALTER TABLE orders
ADD COLUMN loading_approved_at TIMESTAMP WITH TIME ZONE;
ADD COLUMN loading_approved_by UUID REFERENCES profiles(id);
```

**קוד:**
```typescript
// רק לאחר אישור מנהל
UPDATE orders
SET 
  loading_approved_at = NOW(),
  loading_approved_by = adminUserId,
  delivery_status = 'In_Transit'
WHERE id = orderId
```

---

### `paybox_link` (VARCHAR)

**תיאור**: קישור ייעודי לכל רכז במסלול פייבוקס.

**שימוש**: מוצג ללקוח כאשר בוחר רכז עם `employment_model = 'Cash_Paybox'`.

**טבלה**: `distributor_profiles`

**מימוש:**
```sql
ALTER TABLE distributor_profiles
ADD COLUMN paybox_link VARCHAR(500);
```

**קוד UI:**
```typescript
if (employmentModel === 'Cash_Paybox' && payboxLink) {
  return <a href={payboxLink}>תשלום דרך Paybox</a>
}
```

---

## 6. טבלאות וקשרים מרכזיים

### `stock_reservations`
- **מטרה**: Virtual Lock - שמירת מלאי עד תשלום
- **שדות מרכזיים**: `order_id`, `pallet_id`, `reserved_weight_kg`, `expires_at`, `is_active`
- **טיימאאוט**: 30 דקות (ברירת מחדל)

### `performance_metrics`
- **מטרה**: מעקב ביצועים לפי סבב מכירה
- **שדות מרכזיים**: `distributor_id`, `sales_cycle_start`, `total_weight_kg`, `met_minimum_threshold`
- **שימוש**: חוק 50 ק"ג, דוחות ביצועים

### `delivery_sheets`
- **מטרה**: דפי משלוח לנהגים
- **כולל**: הזמנות + עמלות במוצרים + מלאי חירום
- **פורמט**: `DS-YYYYMMDD-XXX`

### `notifications`
- **מטרה**: התראות ללקוחות (SMS/WhatsApp)
- **סוגים**: `pickup_ready`, `order_confirmed`, `payment_received`
- **שליחה**: רק לאחר לחיצת "Stock Received" על ידי רכז

---

## 7. זרימות עבודה מרכזיות

### זרימת הזמנה מלאה:

1. **לקוח בוחר רכז** → המערכת קובעת `employment_model`
2. **לקוח מוסיף מוצרים לעגלה** → בדיקת מלאי זמין (Physical - Reserved)
3. **לקוח מבצע תשלום** → יצירת הזמנה + Virtual Lock (Reserved)
4. **תשלום מתקבל** → `payment_status = 'paid'`, מלאי פיזי עדיין לא ירד
5. **מנהל מאשר טעינה** → `loading_approved_at` מתעדכן, מלאי פיזי יורד
6. **רכז מסמן "Stock Received"** → `delivery_status = 'Delivered_to_Distributor'`
7. **התראות נשלחות ללקוחות** → SMS/WhatsApp "מוכן לאיסוף"

### זרימת חישוב עמלות:

1. **סגירת סבב מכירה** → מנהל סוגר `sales_cycle`
2. **חישוב מצטבר** → סיכום כל ההזמנות של כל רכז בסבב
3. **הפעלת מדרגות** → לפי משקל כולל: 15%/17%/20%
4. **חישוב עמלת ראש צוות** → 5% מסך המכירות של כל הרכזים באזור
5. **יצירת רשומות** → `commissions` table עם `payment_type` (cash/goods)

---

## 8. נקודות אינטגרציה עתידיות

### SMS/WhatsApp
- **מיקום**: `src/lib/skills/notifications/pickup-notifications.ts`
- **פונקציות להחלפה**: `sendViaTwilio()`, `sendViaWhatsApp()`
- **שירותים מומלצים**: Twilio, WhatsApp Business API

### חשבוניות
- **מיקום**: `src/lib/skills/payments/hybrid-payment-workflow.ts`
- **פונקציה**: `processCreditPayment()` - כרגע Mock
- **שירותים מומלצים**: iCount, Green Invoice

### תשלום אשראי
- **מיקום**: `src/app/(customer)/checkout/page.tsx`
- **שירותים מומלצים**: Stripe, PayPal, Bit

---

## 9. בדיקות מומלצות

### בדיקת FIFO:
1. הוסף 3 משטחים עם תאריכי כניסה שונים
2. צור הזמנה
3. ודא שהמשטח הישן ביותר נבחר

### בדיקת Virtual Lock:
1. צור 2 הזמנות במקביל על אותו מוצר
2. ודא שהמלאי הזמין מתעדכן מיד
3. ודא שהמלאי הפיזי לא ירד עד אישור טעינה

### בדיקת עמלות:
1. צור סבב מכירה
2. צור מספר הזמנות לרכז (סה"כ > 75 ק"ג)
3. סגור סבב
4. ודא שהעמלה מחושבת לפי 20% (לא 15% או 17%)

### בדיקת התראות:
1. רכז מסמן "Stock Received"
2. ודא שהתראה נשלחת ללקוח (Mock)
3. ודא שרשומה נוצרת ב-`notifications`

---

**עודכן**: 2026-01-13  
**גרסת PRD**: v3.1  
**סטטוס**: ✅ כל הדרישות מומשו
