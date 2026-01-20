# מדריך התחברות מהיר - חשבון מנהל

## פרטי התחברות

**אימייל:** `admin-1768297770685@example.com`  
**סיסמה:** `test123456`  
**תפקיד:** מנהל (admin)

## איך להיכנס

1. **פתח דפדפן** ולך ל: http://localhost:3005/login

2. **הכנס את הפרטים:**
   - אימייל: `admin-1768297770685@example.com`
   - סיסמה: `test123456`

3. **לחץ "התחבר"**

4. **אם יש שגיאה**, נסה:
   - לוודא שהשרת רץ (`npm run dev`)
   - לבדוק את ה-console בדפדפן (F12)
   - לנסות לרענן את הדף

## אם זה לא עובד

### אפשרות 1: יצירת משתמש חדש
```bash
curl -X POST "http://localhost:3005/api/create-test-user?role=admin"
```

### אפשרות 2: בדיקת חיבור
```bash
curl http://localhost:3005/api/test-db
```

### אפשרות 3: בדיקת התחברות דרך API
```bash
curl -X POST http://localhost:3005/api/test-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin-1768297770685@example.com","password":"test123456"}'
```

## מה מנהל יכול לראות

- ✅ כל ההזמנות במערכת (לא רק שלו)
- ✅ כל המשתמשים והפרופילים
- ✅ ניהול מוצרים ומחסנים
- ✅ גישה מלאה לכל הפונקציות

## חשבונות נוספים

**מפיץ (distributor):**
- אימייל: `test-1768297414096@example.com`
- סיסמה: `test123456`

**מנהל (admin) - חדש:**
- אימייל: `admin-1768297770685@example.com`
- סיסמה: `test123456`
