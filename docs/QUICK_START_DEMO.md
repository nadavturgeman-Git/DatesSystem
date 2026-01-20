# Quick Start: Demo Data Setup

## Step-by-Step Guide

### 1. Get DATABASE_URL from Supabase

**Location**: Settings → **Database** (NOT General) → Connection string

1. Go to: https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/settings/database
2. Scroll to **"Connection string"** section
3. Copy the **"URI"** connection string
4. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### 2. Create .env.local file

Create `.env.local` in project root:

```env
# Database Connection (from Step 1)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# Supabase API (from Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://cikrfepaurkbrkmmgnnm.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**To get API keys:**
- Go to: Settings → **API**
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Set Up Database Schema

1. Go to **SQL Editor** in Supabase Dashboard
2. Open `supabase-schema.sql` from this project
3. Copy entire file and paste into SQL Editor
4. Click **"Run"** button
5. Verify: Check **Table Editor** - you should see 18+ tables

### 4. Seed Demo Data

Run the seeding script:

```bash
npm run seed:demo
```

This creates:
- ✅ **Warehouses**: Baqaa Warehouse (freezing), Jerusalem Warehouse (cooling)
- ✅ **Products**: Medjool, Deglet Noor, Barhi dates
- ✅ **Inventory**: Demo pallets with different entry dates
- ⚠️ **Users**: Need to be created manually (see Step 5)

### 5. Create Demo Users

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Authentication** → **Users** → **Add user**
2. Create 3 users:
   - **Admin**: `admin@datesystem.com` / password: `admin123`
   - **Distributor**: `distributor@datesystem.com` / password: `distributor123`
   - **Team Leader**: `teamleader@datesystem.com` / password: `teamleader123`

3. After creating users, go to **SQL Editor** and run:

```sql
-- Get user IDs first
SELECT id, email FROM auth.users;

-- Then update create-demo-users.sql with actual UUIDs and run it
```

Or use the helper script `create-demo-users.sql` (update UUIDs first).

#### Option B: Quick SQL (if you know user IDs)

```sql
-- Replace UUIDs with actual user IDs from auth.users
INSERT INTO profiles (id, full_name, role, email) VALUES
  ('admin-uuid', 'Admin User', 'admin', 'admin@datesystem.com'),
  ('distributor-uuid', 'Distributor User', 'distributor', 'distributor@datesystem.com'),
  ('teamleader-uuid', 'Team Leader User', 'team_leader', 'teamleader@datesystem.com')
ON CONFLICT (id) DO NOTHING;

-- Create distributor profile with Cash_Paybox model
INSERT INTO distributor_profiles (user_id, employment_model, paybox_link)
VALUES ('distributor-uuid', 'Cash_Paybox', 'https://paybox.co.il/test-link-123')
ON CONFLICT (user_id) DO NOTHING;

-- Assign distributor to team leader
UPDATE profiles SET team_leader_id = 'teamleader-uuid' WHERE id = 'distributor-uuid';
```

### 6. Run Test Scenarios

Now you can run the test scenarios:

```bash
npm run test:scenarios
```

This will:
- ✅ Test all 5 scenarios
- ✅ Generate detailed report (`test-report.md`)
- ✅ Show pass/fail for each verification step

## Verification Checklist

After setup, verify:

- [ ] `.env.local` file exists with `DATABASE_URL`
- [ ] Database schema is created (18+ tables in Supabase)
- [ ] Warehouses exist: "Baqaa Warehouse" and "Jerusalem Warehouse"
- [ ] Products exist: Medjool, Deglet Noor, Barhi
- [ ] At least 1 admin user exists
- [ ] At least 1 distributor user exists
- [ ] Test scenarios run without connection errors

## Troubleshooting

### "Connection refused" error
- Check `DATABASE_URL` is correct
- Verify password is URL-encoded (replace `@` with `%40`, `#` with `%23`, etc.)
- Ensure database is not paused in Supabase

### "Table not found" error
- Run `supabase-schema.sql` in SQL Editor
- Check tables exist in Table Editor

### "User not found" error
- Create users via Authentication → Users
- Create profiles using `create-demo-users.sql`

### "Warehouse not found" error
- Run `npm run seed:demo` again
- Check warehouses exist: `SELECT * FROM warehouses;`

## Next Steps

After demo data is set up:
1. Run test scenarios: `npm run test:scenarios`
2. Review test report: `test-report.md`
3. Fix any failures reported
4. Start development server: `npm run dev`

## Files Reference

- `seed-demo-data.ts` - Demo data seeding script
- `create-demo-users.sql` - SQL script for creating user profiles
- `test-scenarios.ts` - Test scenarios runner
- `SUPABASE_CONNECTION_GUIDE.md` - Detailed connection guide
- `TEST_INSTRUCTIONS.md` - Test execution instructions
