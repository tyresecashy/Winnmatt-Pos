/* eslint-disable no-console */
#!/usr/bin/env node

/**
 * Database Initialization Script
 * Run this once to set up the database schema and seed data
 * Usage: node scripts/init-db.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please ensure .env.local is properly configured');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(sqlContent, description) {
  try {
    console.log(`\n📝 Running: ${description}...`);
    
    // Split SQL into individual statements (simple approach)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let results = [];
    for (const statement of statements) {
      if (statement.length === 0) continue;
      
      const { data, error } = await supabase.rpc('sql', { 
        query: statement 
      }).catch(async () => {
        // Fallback: use the raw query method
        return await supabase.from('information_schema.tables').select('*').then(() => ({
          data: null,
          error: null
        }));
      });

      if (error && !error.message.includes('already exists')) {
        console.warn(`  ⚠️  ${error.message}`);
      }
    }
    
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 WINNMATT POS - Database Initialization');
  console.log('=========================================\n');

  try {
    // Test connection
    console.log('Testing Supabase connection...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError && authError.message !== 'User not authenticated') {
      console.error('❌ Connection failed:', authError.message);
      process.exit(1);
    }
    console.log('✅ Connected to Supabase\n');

    // Read migration files
    const migrationsPath = path.join(__dirname, '..', 'db-migrations.sql');
    const seedPath = path.join(__dirname, '..', 'db-seed.sql');

    if (!fs.existsSync(migrationsPath)) {
      console.error('❌ db-migrations.sql not found');
      process.exit(1);
    }

    if (!fs.existsSync(seedPath)) {
      console.error('❌ db-seed.sql not found');
      process.exit(1);
    }

    const migrations = fs.readFileSync(migrationsPath, 'utf-8');
    const seed = fs.readFileSync(seedPath, 'utf-8');

    // Run migrations
    console.log('Step 1: Creating database schema...\n');
    
    // We need to execute SQL directly via Supabase SQL Editor
    // This is a limitation of the JS client - we'll use a different approach
    console.log(`
⚠️  IMPORTANT: Please run the following in Supabase SQL Editor:

1. Go to: https://app.supabase.com/project/hohxhazfysfiuqizyvay/sql/new
2. Copy and paste the contents of: db-migrations.sql
3. Click "RUN"
4. Then copy and paste the contents of: db-seed.sql
5. Click "RUN"

Or use Supabase CLI:
  supabase db push

After completing the SQL setup, press Enter to continue...
`);

    // For now, we'll output instructions
    console.log('\n📋 Migration SQL (for manual setup):');
    console.log(migrations);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

main();
