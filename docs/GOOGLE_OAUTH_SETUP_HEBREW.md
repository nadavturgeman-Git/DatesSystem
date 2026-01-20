# מדריך הגדרת Google OAuth - בעברית

## סטטוס נוכחי

✅ **הקוד מוכן לחלוטין!**
- כפתור Google בדף ההתחברות
- כפתור Google בדף ההרשמה  
- Callback handler שיוצר פרופיל אוטומטית
- טיפול בשגיאות משופר

⚠️ **מה שצריך לעשות:**
- הגדרת Google OAuth credentials ב-Google Cloud Console
- הגדרת ה-credentials ב-Supabase

---

## שלב 1: יצירת Google OAuth Credentials

### 1.1. פתיחת Google Cloud Console

1. לך ל: https://console.cloud.google.com/
2. התחבר עם חשבון Google שלך

### 1.2. יצירת פרויקט חדש

1. לחץ על "Select a project" (בחירת פרויקט) למעלה
2. לחץ על "New Project" (פרויקט חדש)
3. שם הפרויקט: `Date Palm System` (או כל שם אחר)
4. לחץ "Create" (יצירה)
5. המתן כמה שניות עד שהפרויקט נוצר

### 1.3. הגדרת OAuth Consent Screen

1. בתפריט השמאלי, לך ל: **APIs & Services** → **OAuth consent screen**
2. בחר **External** (חיצוני) ולחץ **Create**
3. מלא את הפרטים:
   - **App name**: `Date Palm Farm Management`
   - **User support email**: האימייל שלך
   - **Developer contact information**: האימייל שלך
4. לחץ **Save and Continue**
5. בדף **Scopes** - לחץ **Save and Continue** (דלג)
6. בדף **Test users** - לחץ **Save and Continue** (דלג)
7. בדף **Summary** - לחץ **Back to Dashboard**

### 1.4. יצירת OAuth 2.0 Client ID

1. בתפריט השמאלי, לך ל: **APIs & Services** → **Credentials**
2. לחץ על **+ CREATE CREDENTIALS** → **OAuth client ID**
3. בחר **Web application** (יישום אינטרנט)
4. שם: `Date Palm System Web Client`
5. **Authorized JavaScript origins** (מקורות JavaScript מורשים):
   ```
   http://localhost:3005
   https://nvebsxgkikhovgfioouw.supabase.co
   ```
6. **Authorized redirect URIs** (כתובות הפניה מורשות):
   ```
   https://nvebsxgkikhovgfioouw.supabase.co/auth/v1/callback
   ```
7. לחץ **Create**
8. **חשוב!** העתק את **Client ID** ואת **Client Secret** - תצטרך אותם בשלב הבא!

---

## שלב 2: הגדרת Supabase

### 2.1. פתיחת Supabase Dashboard

1. לך ל: https://supabase.com/dashboard/project/nvebsxgkikhovgfioouw
   (או לפרויקט שלך אם יש לך ID אחר)

### 2.2. הגדרת Google Provider

1. בתפריט השמאלי, לחץ על **Authentication**
2. לחץ על הטאב **Providers**
3. מצא את **Google** ברשימה
4. לחץ על **Google** כדי לפתוח את ההגדרות

### 2.3. הזנת Credentials

1. הפעל את המתג **Enable** (הפעל)
2. הדבק את **Client ID** מ-Google Cloud Console
3. הדבק את **Client Secret** מ-Google Cloud Console
4. לחץ **Save** (שמור)

---

## שלב 3: בדיקה

### 3.1. בדיקת ההתחברות

1. לך ל: http://localhost:3005/login
2. לחץ על **"התחבר עם Google"**
3. בחר את חשבון Google שלך
4. אשר את ההרשאות
5. אתה אמור להיות מועבר לדשבורד!

### 3.2. בדיקת ההרשמה

1. לך ל: http://localhost:3005/signup
2. לחץ על **"הירשם עם Google"**
3. בחר את חשבון Google שלך
4. אשר את ההרשאות
5. פרופיל יווצר אוטומטית ותועבר לדשבורד!

---

## פתרון בעיות

### שגיאה: "OAuth provider not configured"
**פתרון:**
- ודא שהפעלת את Google Provider ב-Supabase (המתג הוא ON)
- ודא שהדבקת את Client ID ו-Client Secret נכון
- ודא שלחצת Save ב-Supabase

### שגיאה: "Redirect URI mismatch"
**פתרון:**
- ודא שהכתובת ב-Google Console תואמת בדיוק:
  `https://nvebsxgkikhovgfioouw.supabase.co/auth/v1/callback`
- זה רגיש לאותיות גדולות/קטנות!
- ודא שהוספת גם את `http://localhost:3005` ב-Authorized JavaScript origins

### שגיאה: "Access blocked"
**פתרון:**
- ודא שסיימת את הגדרת OAuth Consent Screen
- אם אתה במצב Testing, הוסף את האימייל שלך כ-Test User
- או פרסם את האפליקציה (Publish App)

### פרופיל לא נוצר
**פתרון:**
- ודא שהרצת את מדיניות RLS (`fix-profile-rls-policy.sql`)
- בדוק את הלוגים ב-Supabase → Logs → API
- המשתמש כבר מחובר, רק צריך לוודא שהפרופיל נוצר

---

## מה קורה מאחורי הקלעים?

### תהליך ההתחברות:
```
1. המשתמש לוחץ "התחבר עם Google"
   ↓
2. מועבר ל-Google להתחברות
   ↓
3. Google מאמת את המשתמש
   ↓
4. Google מחזיר קוד ל: /auth/callback?code=xyz
   ↓
5. ה-callback handler שלנו:
   - מחליף את הקוד לסשן
   - בודק אם יש פרופיל
   - יוצר פרופיל אם צריך (עם שם/אימייל מ-Google)
   ↓
6. מועבר לדשבורד
   ↓
7. המשתמש מחובר! 🎉
```

### יצירת פרופיל אוטומטית:
- אם אין פרופיל, נוצר אחד אוטומטית
- שם מלא: מהמטא-דאטה של Google (או שם משתמש מהאימייל)
- אימייל: מחשבון Google
- תפקיד: "distributor" (ברירת מחדל)
- טלפון: null (ניתן לעדכן אחר כך)

---

## קבצים רלוונטיים

- `src/app/(auth)/login/page.tsx` - דף התחברות עם כפתור Google
- `src/app/(auth)/signup/page.tsx` - דף הרשמה עם כפתור Google
- `src/app/auth/callback/route.ts` - מטפל ב-callback מ-Google
- `GOOGLE_OAUTH_SETUP.md` - מדריך באנגלית (מפורט יותר)

---

## הצלחה! 🎉

אחרי שתסיים את ההגדרות:
- ✅ המשתמשים יוכלו להירשם עם Google
- ✅ המשתמשים יוכלו להתחבר עם Google
- ✅ פרופילים יווצרו אוטומטית
- ✅ הכל עובד בצורה חלקה!

**הערה:** אם אתה מפתח לפרודקשן, תצטרך להוסיף את הדומיין שלך ל-Google Console גם כן.
