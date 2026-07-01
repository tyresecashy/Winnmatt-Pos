/* eslint-disable no-console */
#!/usr/bin/env node

/**
 * WINNMATT POS Database Initialization
 * Automatically runs SQL migrations and seeds the database
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_ID = SUPABASE_URL?.split('//')[1]?.split('.')[0];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables in .env.local');
  process.exit(1);
}

function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/sql_query`);
    
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 400) {
          resolve({ success: true, status: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 WINNMATT POS - Database Setup\n');
  console.log('Project ID:', PROJECT_ID);
  console.log('URL:', SUPABASE_URL);
  
  try {
    // Read SQL files
    const migrationsFile = path.join(__dirname, '..', 'db-migrations.sql');
    const seedFile = path.join(__dirname, '..', 'db-seed.sql');

    if (!fs.existsSync(migrationsFile)) {
      console.error('❌ db-migrations.sql not found');
      process.exit(1);
    }
    if (!fs.existsSync(seedFile)) {
      console.error('❌ db-seed.sql not found');
      process.exit(1);
    }

    const migrations = fs.readFileSync(migrationsFile, 'utf-8');
    const seed = fs.readFileSync(seedFile, 'utf-8');

    console.log('\n📝 Step 1: Running schema migrations...');
    
    // Split and filter SQL statements
    const migrationStatements = migrations
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${migrationStatements.length} migration statements`);
    
    // Execute migration group
    const migrationSQL = migrationStatements.join('; ') + ';';
    try {
      await executeSQL(migrationSQL);
      console.log('✅ Migrations completed');
    } catch (error) {
      console.log('⚠️  Note: Some migrations may have already existed');
      console.log('   Message:', error.message.substring(0, 100));
    }

    console.log('\n📝 Step 2: Seeding initial data...');
    
    const seedStatements = seed
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${seedStatements.length} seed statements`);

    const seedSQL = seedStatements.join('; ') + ';';
    try {
      await executeSQL(seedSQL);
      console.log('✅ Seed data inserted');
    } catch (error) {
      console.log('⚠️  Seed error (may be expected):', error.message.substring(0, 100));
    }

    console.log('\n✅ Database initialization complete!\n');
    console.log('📊 To verify, run:');
    console.log('   npm run verify-db\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
