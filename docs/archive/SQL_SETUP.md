# 🚀 Database Setup - Quick Start

## Step 1: Go to Supabase SQL Editor

1. Open: https://app.supabase.com/project/hohxhazfysfiuqizyvay/sql/new
2. Create a new query

## Step 2: Run Migrations

Copy ALL the code from `db-migrations.sql` and paste it into the SQL Editor, then click **RUN**:

- Creates all tables (users, products, inventory, sales, etc.)
- Sets up indexes for performance
- Enables Row Level Security (RLS)

Expected: ✅ Query executes without errors

## Step 3: Run Seed Data

Copy ALL the code from `db-seed.sql` and paste it into the SQL Editor, then click **RUN**:

- Creates 3 branches (Main Store, Westlands, Karen)
- Creates 10 product categories
- Creates 18 sample products
- Creates random inventory levels
- Creates 6 sample customers
- Creates 5 suppliers

Expected: ✅ 26 rows inserted (or conflicts handled)

## Step 4: Verify Setup

Run this query in SQL Editor to verify:

```sql
SELECT 
  (SELECT COUNT(*) FROM products) as products,
  (SELECT COUNT(*) FROM branches) as branches,
  (SELECT COUNT(*) FROM categories) as categories,
  (SELECT COUNT(*) FROM inventory) as inventory_records;
```

Expected result:
- products: 18
- branches: 3
- categories: 10
- inventory_records: 54 (18 products × 3 branches)

## Step 5: Verify Environment

Back in your terminal, run:
```bash
npm run dev
```

If everything works, you should see no errors about missing Supabase credentials.

---

**Next Steps:**
1. Complete the SQL setup above
2. Run `npm run dev`
3. We'll implement Supabase authentication next
