/**
 * Run the hold-sale-migration SQL against the Supabase database.
 * Tries pooler first, then attempts alternative connection strategies.
 * Usage: node scripts/run-migration.mjs
 */
import { readFileSync } from 'fs';
import pg from 'pg';

const { Pool } = pg;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://aunnoikvfjgrlejccywv.supabase.co';
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('❌ SUPABASE_DB_PASSWORD not set.');
  process.exit(1);
}

const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Resolve IP addresses manually for diagnostics
async function run() {
  // Strategy 1: Pooler (transaction mode) - port 6543
  console.log('🔌 Trying pooler (port 6543)...');
  try {
    const pool1 = new Pool({
      host: `${projectRef}.supabase.co`,
      port: 6543,
      database: 'postgres',
      user: 'postgres',
      password: dbPassword,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    const client1 = await pool1.connect();
    console.log('✅ Connected via pooler (port 6543)');
    await runMigration(client1);
    await client1.release();
    await pool1.end();
    return;
  } catch (e) {
    console.log(`❌ Pooler failed: ${e.message}`);
  }

  // Strategy 2: Direct connection via IPv6 (hostaddr bypasses DNS)
  console.log('🔌 Trying direct connection via IPv6 (port 5432)...');
  try {
    const pool2 = new Pool({
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: dbPassword,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    });
    const client2 = await pool2.connect();
    console.log('✅ Connected via direct (port 5432)');
    await runMigration(client2);
    await client2.release();
    await pool2.end();
    return;
  } catch (e) {
    console.log(`❌ Direct connection failed: ${e.message}`);
  }

  // Strategy 3: Try with IP addresses manually resolved
  console.log('🔌 Trying with IPv6 address directly...');
  const v6addr = '2a05:d014:1e9b:b301:e7b2:27a3:c5c8:7ad1';
  try {
    const pool3 = new Pool({
      host: v6addr,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: dbPassword,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    });
    const client3 = await pool3.connect();
    console.log('✅ Connected via IPv6 (port 5432)');
    await runMigration(client3);
    await client3.release();
    await pool3.end();
    return;
  } catch (e) {
    console.log(`❌ IPv6 connection failed: ${e.message}`);
  }

  // Strategy 4: Pooler session mode with pgbouncer=true
  console.log('🔌 Trying pooler session mode (port 5432)...');
  try {
    const pool4 = new Pool({
      host: `${projectRef}.supabase.co`,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: dbPassword,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
    });
    const client4 = await pool4.connect();
    console.log('✅ Connected via pooler session mode (port 5432)');
    await runMigration(client4);
    await client4.release();
    await pool4.end();
    return;
  } catch (e) {
    console.log(`❌ Pooler session mode failed: ${e.message}`);
  }

  console.error('\n❌ All connection strategies failed.');
  console.error('Please run the migration manually via Supabase Dashboard SQL Editor:');
  console.error('  https://supabase.com/dashboard/project/aunnoikvfjgrlejccywv/sql/new');
  process.exit(1);
}

async function runMigration(client) {
  const sql = readFileSync(
    new URL('../hold-sale-migration.sql', import.meta.url),
    'utf-8'
  );

  console.log('📝 Running migration...');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

    // Verify
    const { rows: constraints } = await client.query(`
      SELECT conname AS constraint_name
      FROM pg_constraint
      WHERE conrelid = 'sales'::regclass
        AND contype = 'c'
        AND conname = 'sales_sale_status_check'
    `);
    console.log(`🔍 Check constraint: ${constraints[0]?.constraint_name || 'NOT FOUND'}`);

    const { rows: cols } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'sales' AND column_name = 'hold_notes'
    `);
    console.log(`🔍 Column hold_notes: ${cols[0]?.column_name || 'NOT FOUND'} (${cols[0]?.data_type || ''})`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

run();
