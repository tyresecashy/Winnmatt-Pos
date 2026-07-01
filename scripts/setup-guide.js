#!/usr/bin/env node

/**
 * WINNMATT POS - Interactive Setup Helper
 * Guides you through the database setup process
 */

const fs = require('fs');
const path = require('path');

const migrationsPath = path.join(__dirname, '..', 'db-migrations.sql');
const seedPath = path.join(__dirname, '..', 'db-seed.sql');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🚀 WINNMATT POS - Database Setup Helper                   ║
╚══════════════════════════════════════════════════════════════╝

This script will help you set up your Supabase database.

IMPORTANT: You need to manually run SQL in Supabase because the
JavaScript client doesn't support arbitrary SQL execution.

But don't worry - the SQL is ready to copy-paste!

═══════════════════════════════════════════════════════════════

STEP 1: Copy the Migration SQL
───────────────────────────────

1. Open your browser and go to:
   👉 https://app.supabase.com/project/hohxhazfysfiuqizyvay/sql/new

2. Click "New query"

3. COPY THIS SQL (all of it):
   ┌─ START COPY HERE ──────────────────────────────────────────────┐
`);

// Read and emit migrations
const migrations = fs.readFileSync(migrationsPath, 'utf-8');
console.log(migrations);

console.log(`   └─ END COPY ────────────────────────────────────────────────────┘

4. Paste it into the Supabase SQL editor

5. Click the blue "RUN" button

6. Wait for it to complete (takes ~2 seconds)

═══════════════════════════════════════════════════════════════

STEP 2: Copy the Seed Data
───────────────────────────

1. Click "New query" to create another query

2. COPY THIS SQL (all of it):
   ┌─ START COPY HERE ──────────────────────────────────────────────┐
`);

// Read and emit seed
const seed = fs.readFileSync(seedPath, 'utf-8');
console.log(seed);

console.log(`   └─ END COPY ────────────────────────────────────────────────────┘

3. Paste it into the Supabase SQL editor

4. Click the blue "RUN" button

5. Wait for completion

═══════════════════════════════════════════════════════════════

STEP 3: Verify Setup (back in terminal)
────────────────────────────────────────

Once you've run both SQL queries in Supabase, run this command:

   npm run verify-db

This will check that all tables and data were created correctly.

═══════════════════════════════════════════════════════════════

Need help?

- Table not found? Make sure you ran the MIGRATIONS first
- Only 1-5 rows? You probably forgot the SEED step
- Connection error? Check your .env.local file
- Still stuck? Share the error message

═══════════════════════════════════════════════════════════════
`);
