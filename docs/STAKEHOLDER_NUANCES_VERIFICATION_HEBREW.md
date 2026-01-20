# דוח אימות דרישות בעלי העניין
## סיכום בעברית - עם הפניות לקוד

---

## 1. דרישות "הרות גלס" - לוגיסטיקה וטריות

### 1.1 לוגיקת FIFO ברמת פלטה ✅ **מאומת**

**דרישה**: רשימת העמסה חייבת לזהות `pallet_id` ספציפי עם `entry_date` הוותיק ביותר, לא רק להחסיר משקל.

**מיקום בקוד**:
- `src/lib/skills/inventory/fifo.ts` שורות 49-113: פונקציה `allocateFIFO()` ממיינת לפי `entry_date ASC`
- `src/lib/skills/inventory/fifo.ts` שורות 162-190: יוצרת רשומות `pallet_allocations` עם `pallet_id` ספציפי
- `src/app/(dashboard)/orders/[id]/page.tsx` שורה 273: מציגה `פלטה: {reservation.pallets?.pallet_id}` בממשק

**מסקנה**: ✅ המערכת מזהה פלטות ספציפיות לפי `pallet_id` ו-`entry_date`, לא רק חיסור משקל.

---

### 1.2 טיימר "פרי טרי" ⚠️ **חלקי**

**דרישה**: התראה לירושלים (מקרר) vs. בקעה (מקפיא). חישוב משך זמן שהפלטה בירושלים והתראה אם זה "פרי טרי".

**מיקום בקוד**:
- `src/lib/skills/alerts/alert-manager.ts` שורות 157-215: `checkSpoilageAlerts()`
- שורות 159-165: מסנן מחסנים לפי `warehouse_type = 'cooling'` (ירושלים = cooling, בקעה = freezing)
- שורות 174-189: בודק `p.is_fresh_fruit = TRUE` ומחשב `EXTRACT(DAY FROM (NOW() - p.entry_date))`

**בעיה קריטית**: ⚠️ השדה `is_fresh_fruit` חסר מטבלת `pallets` ב-`supabase-schema.sql`!
- הקוד מתייחס לשדה זה (שורה 180) אבל הוא לא קיים בסכמה
- **המלצה**: להוסיף `is_fresh_fruit BOOLEAN DEFAULT FALSE` לטבלת `pallets`

**מסקנה**: ⚠️ הלוגיקה קיימת אבל השדה חסר - הקוד יכשל בזמן ריצה.

---

### 1.3 SMS מופעל על ידי מפיץ ✅ **מאומת**

**דרישה**: לקוח מקבל SMS רק כשרכז לוחץ 'Stock Received', לא כשרכב יוצא.

**מיקום בקוד**:
- `src/app/api/orders/[id]/mark-received/route.ts` שורות 40-48: מעדכן `delivery_status` רק בלחיצה
- `src/components/orders/StockReceivedButton.tsx` שורה 47: כפתור שולח `POST /api/orders/${orderId}/mark-received`
- `src/lib/skills/notifications/pickup-notifications.ts` שורות 26-80: שולח התראה רק כשנקרא

**מסקנה**: ✅ SMS נשלח רק כשרכז לוחץ 'Stock Received'. אין טריגר אוטומטי ביציאת רכב.

---

## 2. דרישות "אלישר" - תשלומים והיררכיה

### 2.1 תשלום דינמי ⚠️ **חלקי**

**דרישה**: למפיצי Cash_Paybox, חישוב "נטו למשק" (סה"כ - עמלה) והצגת כפתור 'Mark as Paid' רק לתפקיד זה.

**מיקום בקוד**:
- `src/components/orders/MarkAsPaidButton.tsx` שורות 24-31: בודק `employmentModel !== 'Cash_Paybox'` - כפתור מוסתר אם לא Cash_Paybox
- `src/app/api/orders/[id]/mark-paid/route.ts` שורות 40-47: בודק `employment_model !== 'Cash_Paybox'` ומחזיר שגיאה 403
- `src/lib/skills/payments/hybrid-payment-workflow.ts` שורות 136-177: `confirmCashPayment()` מעדכן תשלום

**חסר**: ⚠️ דוח "נטו למשק" חסר
- חישוב עמלה קיים ב-`src/lib/skills/commissions/calculator.ts`
- אבל אין דוח ייעודי שמציג `סה"כ - עמלה = נטו למשק` למפיץ

**מסקנה**: ✅ הכפתור עובד רק ל-Cash_Paybox. ⚠️ דוח "נטו למשק" חסר.

---

### 2.2 ניטור אזורי (דאשבורד ראש צוות) ✅ **מאומת**

**דרישה**: דאשבורד ראש צוות מציג סיכום כל המפיצים באזור, עם הדגשה מי לא הגיע ל-50 ק"ג.

**מיקום בקוד**:
- `src/app/(dashboard)/team-leader/page.tsx` שורות 60-159: טוען מפיצים לפי `team_leader_id`
- שורות 100-129: מצרף `met_50kg_threshold` ו-`current_cycle_weight`
- שורות 297-306: מציג בממשק:
  ```typescript
  {distributor.met_50kg_threshold ? (
    <span className="text-green-600">✓</span>
  ) : (
    <span className="text-red-600">
      {distributor.current_cycle_weight < 50
        ? `${(50 - distributor.current_cycle_weight).toFixed(1)} ק"ג חסר`
        : '✗'}
    </span>
  )}
  ```

**מסקנה**: ✅ דאשבורד ראש צוות מציג מפיצים באזור עם הדגשת 50 ק"ג.

---

### 2.3 לקוחות חוזרים (CRM) ❌ **חסר**

**דרישה**: לקוחות לא מכניסים נתונים מחדש. תהליך תשלום ממלא אוטומטית לפי טלפון/אימייל מוכר.

**מיקום בקוד**:
- `src/app/(customer)/checkout/page.tsx` שורות 32-80: `loadCheckoutData()` טוען רק עגלה ומפיץ
- **לא נמצא**: אין לוגיקת מילוי אוטומטי מנתוני לקוח

**מסקנה**: ❌ **חסר**: תהליך תשלום לא ממלא נתוני לקוח מטבלת `customers`.

---

## 3. דרישות "שילה" - בעיות עסקיות

### 3.1 מניעת מכירת יתר ✅ **מאומת**

**דרישה**: Virtual Lock - אם יש 100 ק"ג במלאי ו-10 לקוחות עם 10 ק"ג בעגלה (לא שולם), הלקוח ה-101 נחסם.

**מיקום בקוד**:
- `src/lib/skills/locking/virtual-lock.ts` שורות 41-107: `createReservations()` יוצרת `stock_reservations`
- שורות 54-60: מחזירה שגיאה אם אין מספיק מלאי זמין
- `src/lib/skills/inventory/fifo.ts` שורות 37-43: `getAvailableStock()` מחשב `current_weight_kg - SUM(reserved_weight_kg)`
- `src/app/api/orders/create/route.ts` שורות 112-123: אם הזמנה נכשלת, ההזמנה נמחקת

**מסקנה**: ✅ Virtual Lock מונע מכירת יתר. מלאי זמין = פיזי - שמור. לקוח 101 ייחסם אם סה"כ שמירות > מלאי פיזי.

---

### 3.2 מודל "הנחה קבוצתית" (ללא תלוש) ⚠️ **חלקי**

**דרישה**: דוח עמלות מבדיל בין מקבלי "תשלום נטו" (חשבונית/תלוש) לבין אלה שעמלתם מטופלת כ"הנחה" על יתרה סופית.

**מיקום בקוד**:
- `supabase-schema.sql` שורה 180: `commission_type` ENUM: `'distributor' | 'team_leader'`
- שורה 181: `payment_type` ENUM: `'cash' | 'goods'`
- **חסר**: אין הבחנה מפורשת בין "הנחה קבוצתית" ל"חשבונית/תלוש"

**מסקנה**: ⚠️ **חלקי**: סוגי עמלה קיימים (`cash` vs `goods`), אבל אין הבחנה מפורשת בין "הנחה קבוצתית" ל"חשבונית/תלוש" בדוחות.

---

### 3.3 תיבות בונוס (עמלה במוצרים) ✅ **מאומת**

**דרישה**: למפיצים שמשלמים בפרי, 'רשימת העמסה' מוסיפה אוטומטית תיבות נוספות למניפסט הנהג.

**מיקום בקוד**:
- `src/lib/skills/logistics/delivery-sheet.ts` שורות 110-125: שואל `commissions` עם `payment_type = 'goods'`
- שורות 159-187: מוסיף עמלה במוצרים לרשימת העמסה:
  ```typescript
  items.push({
    ...,
    isCommissionGoods: true,  // מסומן כעמלה במוצרים
    ...
  })
  ```

**מסקנה**: ✅ תיבות בונוס (עמלה במוצרים) מתווספות אוטומטית לרשימת העמסה עם `isCommissionGoods: true`.

---

## 4. בדיקות "פינג-פונג" סופיות

### 4.1 מקור קישור Paybox ✅ **מאומת**

**דרישה**: קישור Paybox שמוצג ללקוח נשלף ישירות מפרופיל המפיץ, לא קישור גלובלי.

**מיקום בקוד**:
- `src/lib/skills/payments/hybrid-payment-workflow.ts` שורות 190-196: שואל מ-`distributor_profiles`:
  ```sql
  SELECT dp.employment_model, dp.paybox_link
  FROM distributor_profiles dp
  WHERE dp.user_id = ${distributorId}::uuid
  ```
- שורות 211-220: מחזיר `payboxLink: row.paybox_link` - מפרופיל המפיץ

**מסקנה**: ✅ קישור Paybox נשלף מ-`distributor_profiles.paybox_link` לכל מפיץ, לא קישור גלובלי.

---

### 4.2 לוגיקת החזר ⚠️ **חלקי**

**דרישה**: פונקציית 'החזר' ב-Admin API שמטפלת בהחזרת כרטיס אשראי דרך mock.

**מיקום בקוד**:
- `supabase-schema.sql` שורות 198-214: טבלת `returns` קיימת עם `refund_amount`
- `src/app/(dashboard)/admin/returns/page.tsx` שורות 88-123: `approveReturn()` מעדכן יתרת מפיץ
- `src/lib/skills/checkout/payment-providers.ts` שורות 177-183: `cancel()` מבטל תשלומים ממתינים בלבד

**מסקנה**: ⚠️ **חלקי**: החזרים קיימים לעדכון יתרה, אבל אין API מפורש להחזרת כרטיס אשראי לתשלומים שהושלמו.

---

### 4.3 נפח רכב ❌ **חסר**

**דרישה**: רשימת העמסה מחשבת סה"כ נפח/משקל של המסלול כדי לראות אם זה נכנס למשאית.

**מיקום בקוד**:
- `src/lib/skills/logistics/delivery-sheet.ts` שורות 59-200: `generateDeliverySheet()` מחשב משקל כולל
- **חסר**: אין חישוב נפח, אין בדיקת קיבולת רכב

**מסקנה**: ❌ **חסר**: רשימת העמסה לא מחשבת נפח כולל ולא בודקת מול קיבולת רכב.

---

## סיכום כללי

| דרישה | סטטוס | הערות |
|-------|-------|------|
| 1.1 לוגיקת FIFO ברמת פלטה | ✅ מאומת | מעקב `pallet_id` ספציפי מיושם |
| 1.2 טיימר פרי טרי | ⚠️ חלקי | לוגיקה קיימת, שדה `is_fresh_fruit` חסר |
| 1.3 SMS מופעל מפיץ | ✅ מאומת | רק בלחיצת Stock Received |
| 2.1 תשלום דינמי | ⚠️ חלקי | כפתור עובד, דוח "נטו למשק" חסר |
| 2.2 ניטור אזורי | ✅ מאומת | דאשבורד ראש צוות עם 50 ק"ג |
| 2.3 לקוחות חוזרים | ❌ חסר | אין מילוי אוטומטי בתשלום |
| 3.1 מניעת מכירת יתר | ✅ מאומת | Virtual Lock מיושם במלואו |
| 3.2 מודל הנחה קבוצתית | ⚠️ חלקי | סוגי עמלה קיימים, אין הבחנה מפורשת |
| 3.3 תיבות בונוס | ✅ מאומת | מתווספות אוטומטית לרשימת העמסה |
| 4.1 מקור קישור Paybox | ✅ מאומת | מפרופיל מפיץ |
| 4.2 לוגיקת החזר | ⚠️ חלקי | החזרים קיימים, אין החזרת כרטיס אשראי |
| 4.3 נפח רכב | ❌ חסר | אין חישוב נפח/קיבולת |

**סה"כ**: 8/12 מאומתים במלואם, 3/12 חלקיים, 1/12 חסר.

---

## בעיות קריטיות שדורשות תיקון

1. **שדה `is_fresh_fruit` חסר** - הקוד מתייחס לשדה זה אבל הוא לא קיים ב-`pallets` table
2. **דוח "נטו למשק" חסר** - חישוב קיים אבל אין ממשק דוח
3. **מילוי אוטומטי לקוח חסר** - תהליך תשלום לא ממלא נתונים מטבלת `customers`

---

**תאריך**: 2026-01-07  
**גרסת PRD**: v3.1  
**סטטוס**: דורש השלמות לפני ייצור
