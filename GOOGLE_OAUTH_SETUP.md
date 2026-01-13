# Google OAuth Setup Guide

## What We Built

✅ **Login page** with "Sign in with Google" button
✅ **Signup page** with "Sign up with Google" button
✅ **OAuth callback handler** (`/auth/callback`) that creates user profiles automatically

---

## How to Enable Google OAuth in Supabase

### Step 1: Get Google OAuth Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** (or select existing)
   - Click "Select a project" → "New Project"
   - Name it: "Date Palm System"
   - Click "Create"

3. **Enable Google+ API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" → "OAuth consent screen"
   - Select "External" user type
   - Fill in:
     - App name: "Date Palm Farm Management"
     - User support email: Your email
     - Developer contact: Your email
   - Click "Save and Continue"
   - Skip "Scopes" → Click "Save and Continue"
   - Skip "Test users" → Click "Save and Continue"

5. **Create OAuth 2.0 Client ID**:
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "Date Palm System Web Client"
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3005
     https://cikrfepaurkbrkmmgnnm.supabase.co
     ```
   - **Authorized redirect URIs**:
     ```
     https://cikrfepaurkbrkmmgnnm.supabase.co/auth/v1/callback
     ```
   - Click "Create"
   - **Copy the Client ID and Client Secret** (you'll need these!)

---

### Step 2: Configure Supabase

1. **Go to your Supabase project**:
   https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm

2. **Navigate to Authentication → Providers**:
   - Click "Authentication" in sidebar
   - Click "Providers" tab
   - Find "Google" in the list

3. **Enable and Configure Google**:
   - Toggle "Enable" to ON
   - Paste your **Client ID** from Google
   - Paste your **Client Secret** from Google
   - Click "Save"

---

### Step 3: Test the Integration

1. **Go to your app**: http://localhost:3005/login

2. **Click "התחבר עם Google"** (Sign in with Google)

3. **Select your Google account**

4. **Grant permissions**

5. **You'll be redirected back** to the dashboard automatically!

---

## What Happens Behind the Scenes

### Flow:
```
1. User clicks "Sign in with Google"
   ↓
2. Redirected to Google login
   ↓
3. User authenticates with Google
   ↓
4. Google redirects to: /auth/callback?code=xyz
   ↓
5. Our callback handler:
   - Exchanges code for session
   - Checks if profile exists
   - Creates profile if needed (with Google name/email)
   ↓
6. Redirects to /dashboard
   ↓
7. User is logged in! 🎉
```

### Profile Auto-Creation:
- If user doesn't have a profile, we create one automatically
- Full name: From Google metadata (or email username)
- Email: From Google account
- Role: "distributor" (default)
- Phone: null (can be updated later)

---

## Features

### ✅ Seamless Integration
- Works alongside email/password auth
- No duplicate accounts (same email = same user)
- Automatic profile creation

### ✅ Beautiful UI
- Google's official colors (#4285F4, #34A853, #FBBC05, #EA4335)
- Official Google logo
- Hebrew text with RTL support
- "או" (or) divider between methods

### ✅ Security
- OAuth 2.0 standard
- Supabase handles token exchange
- No password storage needed
- Automatic session management

---

## Troubleshooting

### "OAuth provider not configured"
- Make sure you saved the Client ID/Secret in Supabase
- Check that Google provider is enabled (toggle is ON)

### "Redirect URI mismatch"
- Make sure the redirect URI in Google Console matches:
  `https://cikrfepaurkbrkmmgnnm.supabase.co/auth/v1/callback`
- Case-sensitive!

### "Access blocked"
- Make sure you published your OAuth consent screen
- Or add your email as a test user

### User created but no profile
- Check the callback handler logs
- The callback creates profiles automatically
- RLS policies might be blocking (check Supabase logs)

---

## Production Setup

When deploying to production:

1. **Add production domain** to Google Console:
   - Authorized JavaScript origins:
     ```
     https://yourdomain.com
     ```
   - Authorized redirect URIs:
     ```
     https://cikrfepaurkbrkmmgnnm.supabase.co/auth/v1/callback
     ```

2. **Publish OAuth consent screen**:
   - Go back to "OAuth consent screen"
   - Click "Publish App"
   - Submit for verification (if needed)

3. **Update .env.local** if needed:
   - `NEXT_PUBLIC_APP_URL=https://yourdomain.com`

---

## Files Modified

1. **src/app/(auth)/login/page.tsx**
   - Added `handleGoogleLogin()` function
   - Added "Sign in with Google" button
   - Added Google logo SVG

2. **src/app/(auth)/signup/page.tsx**
   - Added `handleGoogleSignup()` function
   - Added "Sign up with Google" button
   - Added Google logo SVG

3. **src/app/auth/callback/route.ts** (NEW)
   - Handles OAuth callback
   - Exchanges code for session
   - Auto-creates profiles for new Google users

---

## Testing Checklist

- [ ] Google button appears on /login
- [ ] Google button appears on /signup
- [ ] Clicking button redirects to Google
- [ ] Can select Google account
- [ ] Redirects back to app after auth
- [ ] Profile created in database
- [ ] User lands on /dashboard
- [ ] Can log out and log back in
- [ ] Email shown in navigation

---

## Next Steps

Once Google OAuth is working:

1. **Add more providers** (optional):
   - GitHub OAuth
   - Facebook OAuth
   - Microsoft OAuth

2. **Enhance profile creation**:
   - Ask for phone number after first login
   - Show welcome wizard for new users
   - Let users complete their profile

3. **Add social features**:
   - Show profile picture from Google
   - Display Google name
   - Sync Google contacts (advanced)

---

**🎉 Your app now supports Google authentication!**
