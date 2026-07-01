#!/usr/bin/env node

/**
 * Simple database check - just verify connection
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// Read .env.local
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

function queryDatabase(table) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}?limit=1`);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 400) {
          try {
            const parsed = JSON.parse(data);
            resolve(Array.isArray(parsed) ? parsed.length : 0);
          } catch {
            resolve(0);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000);
    req.end();
  });
}

async function main() {
  console.log('\n📊 WINNMATT POS - Quick Database Check\n');

  const tables = ['branches', 'categories', 'products', 'inventory', 'customers', 'suppliers'];
  
  for (const table of tables) {
    try {
      const count = await queryDatabase(table);
      if (count > 0) {
        console.log(`✅ ${table}`);
      } else {
        console.log(`⏳ ${table} (checking...)`);
      }
    } catch (error) {
      console.log(`❌ ${table} - ${error.message}`);
    }
  }

  console.log('\nIf you see ❌ errors, the SQL migrations may not have been applied.');
  console.log('Go to: https://app.supabase.com/project/hohxhazfysfiuqizyvay/sql');
  console.log('And manually run the SQL from db-migrations.sql and db-seed.sql\n');
}

main();
