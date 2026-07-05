# 🚀 Supabase Quick Setup Guide

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "Start Your Project" or "New Project"
3. Sign up with GitHub or email
4. Create a new project:
   - **Project name:** `winnmatt-pos`
   - **Database password:** Create a strong password (save this!)
   - **Region:** Choose closest to you (e.g., Africa - South Africa if available, else Europe)
5. Wait 2-3 minutes for project initialization

## Step 2: Get Your Credentials

Once project is ready:

1. In Supabase dashboard, click on your project
2. Go to **Settings** (bottom left) → **API**
3. You'll see three things you need:

```
Project URL:
https://your-project-id.supabase.co

Anon Public Key (NEXT_PUBLIC_SUPABASE_ANON_KEY):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Service Role Secret (SUPABASE_SERVICE_ROLE_KEY):
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Important:** Keep Service Role Secret private! Never commit to git.

## Step 3: Create .env.local File

In the project root (`c:\Users\tyres\Desktop\123`), create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_APP_NAME=WINNMATT POS
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Replace with your actual values from Step 2.

## Step 4: Run Database Migrations

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New Query"** button
3. Copy entire contents of `db-migrations.sql` (in project root)
4. Paste into SQL Editor
5. Click **"Run"** button (or Ctrl+Enter)
6. Wait for success message

**What this does:** Creates all 12 database tables with proper schema and relationships.

## Step 5: Seed Sample Data

1. Back in SQL Editor, click **"New Query"** again
2. Copy entire contents of `db-seed.sql` (in project root)
3. Paste into SQL Editor
4. Click **"Run"**

**What this does:** Adds 3 branches, 18 products, 6 customers, 5 suppliers with realistic data.

## Step 6: Create Demo Users in Auth

1. Go to **Authentication** (left sidebar) → **Users**
2. Click **"Add User"** button
3. Create first user:
   - Email: `demo@winnmatt.com`
   - Password: `demo123`
   - ☑️ Auto confirm user
   - Click **"Create User"**

4. Click **"Add User"** again
5. Create second user:
   - Email: `admin@winnmatt.com`
   - Password: `admin123`
   - ☑️ Auto confirm user
   - Click **"Create User"**

**Note:** You'll see their UUIDs after creation - save these for next step.

## Step 7: Link Auth Users to Database

You need to connect the Supabase Auth users to the `users` table in database.

1. Go back to **SQL Editor**
2. Click **"New Query"**
3. Get the UUIDs of the users you just created:
   - Go to **Authentication** → **Users**
   - Copy the UUID of `demo@winnmatt.com`
   - Copy the UUID of `admin@winnmatt.com`

4. Run this SQL (replace the UUID values):

```sql
INSERT INTO users (id, email, full_name, branch_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo@winnmatt.com', 'Demo Cashier', (SELECT id FROM branches WHERE code = 'MAIN-001'), 'cashier'),
  ('22222222-2222-2222-2222-222222222222', 'admin@winnmatt.com', 'Admin User', (SELECT id FROM branches WHERE code = 'MAIN-001'), 'admin');
```

Replace:
- First UUID with demo@winnmatt.com UUID
- Second UUID with admin@winnmatt.com UUID

## Step 8: Start the App

```bash
# In terminal, in project root:
npm run dev

# Open http://localhost:3000 in browser
```

You should see login page. Try logging in with:
```
Email: demo@winnmatt.com
Password: demo123
Branch: Main Store
```

## ✅ Verification Checklist

- [ ] Supabase project created
- [ ] .env.local file created with credentials
- [ ] Database migrations ran (12 tables created)
- [ ] Seed data loaded (branches, products, customers, etc.)
- [ ] Demo users created in Auth
- [ ] User records linked to database
- [ ] App starts without errors
- [ ] Login works with demo credentials
- [ ] Dashboard loads with real data

---

## 🆘 Troubleshooting

### "NEXT_PUBLIC_SUPABASE_URL not found" error

```bash
# Make sure .env.local exists:
ls .env.local

# Then restart dev server:
npm run dev
```

### SQL query says "Permission denied"

This usually means RLS policies are blocking. Check:
1. User is authenticated
2. User record exists in `users` table
3. Branch record exists

### Login page shows empty

1. Check browser console for errors (F12)
2. Verify user exists in Supabase Authentication
3. Verify user record exists in `users` table

### Data not showing on dashboard

1. Check browser Network tab (F12) for failed requests
2. Verify JWT token in browser localStorage
3. Check RLS policies in Supabase

### Can't find your user UUIDs

In Supabase:
1. Go to **Authentication** → **Users**
2. Look at the table - first column is the UUID
3. Copy the exact value

---

## 📚 Helpful Links

- Supabase Console: https://app.supabase.com
- Supabase Docs: https://supabase.com/docs
- SQL Editor Guide: https://supabase.com/docs/reference/sql

---

**Once all steps are complete, the system is ready for Phase 3: Database Integration!**
