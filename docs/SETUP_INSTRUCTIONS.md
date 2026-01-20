# Database Setup Instructions

## Quick Setup (2 Methods)

### Method 1: Via Supabase Dashboard (Easiest - No Password Needed)

1. **Run Schema SQL:**
   - Go to: https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/sql/new
   - Open `supabase-schema.sql` from this project
   - Copy entire file
   - Paste into SQL Editor
   - Click **"Run"** button
   - Wait for completion (should see "Success" message)

2. **Seed Demo Data:**
   ```bash
   npx tsx setup-database-via-api.ts
   ```
   This will create warehouses, products, and demo pallets.

3. **Create Users:**
   - Go to: Authentication → Users → Add user
   - Create 3 users:
     - `admin@datesystem.com` / password: `admin123`
     - `distributor@datesystem.com` / password: `distributor123`
     - `teamleader@datesystem.com` / password: `teamleader123`

4. **Create User Profiles:**
   - Go to SQL Editor again
   - Run this SQL (replace UUIDs with actual user IDs from auth.users):
   ```sql
   -- First, get user IDs
   SELECT id, email FROM auth.users;
   
   -- Then insert profiles (replace UUIDs)
   INSERT INTO profiles (id, full_name, role, email) VALUES
     ('YOUR-ADMIN-UUID', 'Admin User', 'admin', 'admin@datesystem.com'),
     ('YOUR-DISTRIBUTOR-UUID', 'Distributor User', 'distributor', 'distributor@datesystem.com'),
     ('YOUR-TEAMLEADER-UUID', 'Team Leader User', 'team_leader', 'teamleader@datesystem.com')
   ON CONFLICT (id) DO NOTHING;
   
   -- Create distributor profile
   INSERT INTO distributor_profiles (user_id, employment_model, paybox_link)
   VALUES ('YOUR-DISTRIBUTOR-UUID', 'Cash_Paybox', 'https://paybox.co.il/test-link-123')
   ON CONFLICT (user_id) DO NOTHING;
   
   -- Assign distributor to team leader
   UPDATE profiles SET team_leader_id = 'YOUR-TEAMLEADER-UUID' WHERE id = 'YOUR-DISTRIBUTOR-UUID';
   ```

5. **Set up .env.local:**
   Create `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://cikrfepaurkbrkmmgnnm.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa3JmZXBhdXJrYnJrbW1nbm5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTA0NzYsImV4cCI6MjA4Mzg2NjQ3Nn0.qhy6XLX2Gq8tm9cjphQrqBlxpl7Bm0Pc3eyLE13Kxsg
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa3JmZXBhdXJrYnJrbW1nbm5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5MDQ3NiwiZXhwIjoyMDgzODY2NDc2fQ.HeyfiwN-Zb2jMhxTGidBiiPNAweJWELl3My7OBxnLdY
   
   # Get DATABASE_URL from: Settings → Database → Connection string
   # Format: postgresql://postgres:[PASSWORD]@db.cikrfepaurkbrkmmgnnm.supabase.co:5432/postgres
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.cikrfepaurkbrkmmgnnm.supabase.co:5432/postgres
   ```

6. **Run Tests:**
   ```bash
   npm run test:scenarios
   ```

### Method 2: Via Supabase CLI (Requires Database Password)

1. **Get Database Password:**
   - Go to: https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/settings/database
   - Click **"Reset database password"** or use existing password
   - Copy the password

2. **Set DATABASE_URL in .env.local:**
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.cikrfepaurkbrkmmgnnm.supabase.co:5432/postgres
   ```

3. **Push Schema:**
   ```bash
   supabase db push --linked
   # Enter password when prompted
   ```

4. **Seed Data:**
   ```bash
   npm run seed:demo
   ```

5. **Create Users** (same as Method 1, step 3-4)

## Verification

After setup, verify everything works:

```bash
# Test connection
npx tsx setup-database-via-api.ts

# Run test scenarios
npm run test:scenarios
```

## Troubleshooting

### "relation does not exist" error
- Schema not run yet → Run `supabase-schema.sql` in SQL Editor

### "password authentication failed"
- Get/reset password from: Settings → Database
- Update DATABASE_URL in .env.local

### "Could not find column" error
- Schema incomplete → Re-run `supabase-schema.sql`
- Check all migrations completed successfully

### Users not found
- Create users via Authentication → Users
- Create profiles using SQL (see Method 1, step 4)
