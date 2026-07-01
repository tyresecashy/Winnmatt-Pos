/* eslint-disable no-console */
#!/usr/bin/env node

/**
 * WINNMATT POS - Quick Database Verification
 * Checks if the database is properly set up
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
let env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && !key.startsWith('#')) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  console.error('Are you in the project directory and is .env.local configured?');
  process.exit(1);
}

async function verifyDatabase() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log('\n🔍 Verifying WINNMATT POS Database Setup...\n');

  try {
    // Check tables exist
    const checks = [
      { table: 'branches', expectedMin: 3 },
      { table: 'categories', expectedMin: 10 },
      { table: 'products', expectedMin: 18 },
      { table: 'inventory', expectedMin: 50 },
      { table: 'customers', expectedMin: 5 },
      { table: 'suppliers', expectedMin: 5 },
    ];

    let allPass = true;

    for (const check of checks) {
      try {
        const { data, error, count } = await supabase
          .from(check.table)
          .select('*', { count: 'exact', head: true });

        if (error) throw error;

        const rowCount = count || 0;
        const status = rowCount >= check.expectedMin ? '✅' : '⚠️';
        console.log(`${status} ${check.table}: ${rowCount} rows (expected: ${check.expectedMin}+)`);
        
        if (rowCount < check.expectedMin) {
          allPass = false;
        }
      } catch (error) {
        console.log(`❌ ${check.table}: Table not found or error: ${error.message}`);
        allPass = false;
      }
    }

    console.log('\n' + '='.repeat(50));
    if (allPass) {
      console.log('✅ Database is properly set up!');
      console.log('\nYou can now:');
      console.log('  npm run dev         - Start the development server');
      console.log('  npm run build       - Build for production');
    } else {
      console.log('⚠️  Database needs setup');
      console.log('\nTo complete setup:');
      console.log('  1. Go to: https://app.supabase.com/project/hohxhazfysfiuqizyvay/sql/new');
      console.log('  2. Copy all of db-migrations.sql and paste into SQL editor');
      console.log('  3. Click RUN');
      console.log('  4. Create new query and copy all of db-seed.sql');
      console.log('  5. Click RUN');
      console.log('  6. Run this script again to verify');
    }
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nMake sure:');
    console.error('  - .env.local has correct Supabase credentials');
    console.error('  - You are in the project directory');
    console.error('  - Your Supabase project exists');
  }
}

verifyDatabase();
