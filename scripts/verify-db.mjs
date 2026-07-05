/* eslint-disable no-console */
const MGMT_TOKEN = process.env.SUPABASE_MGMT_TOKEN || '';
const REF = process.env.SUPABASE_PROJECT_REF || 'aunnoikvfjgrlejccywv';
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function q(sql) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${MGMT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (!res.ok) { console.error('  ERROR:', JSON.stringify(data).substring(0, 200)); return []; }
  return Array.isArray(data) ? data : [];
}

async function main() {
  console.log('📊 WINNMATT POS — Database Verification\n');

  // Tables
  const tables = await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  console.log(`Tables: ${tables.length}`);
  for (const t of tables) {
    const count = await q(`SELECT COUNT(*)::int AS c FROM "${t.table_name}"`);
    console.log(`  ${t.table_name.padEnd(30)} ${count[0]?.c || 0} rows`);
  }

  // Views
  const views = await q(`SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`);
  console.log(`\nViews: ${views.length}`);
  for (const v of views) {
    console.log(`  ${v.table_name}`);
  }

  // App users
  const appUsers = await q('SELECT email, role, status, full_name FROM users ORDER BY email');
  console.log('\n👤 App Users:');
  for (const u of appUsers) {
    console.log(`  ${u.email.padEnd(30)} ${u.role.padEnd(10)} ${u.status.padEnd(8)} ${u.full_name}`);
  }

  // Branches
  const branches = await q('SELECT name, code, location, is_main FROM branches ORDER BY name');
  console.log('\n🏪 Branches:');
  for (const b of branches) {
    console.log(`  ${b.name.padEnd(20)} ${b.code.padEnd(12)} ${b.location.padEnd(20)} ${b.is_main ? '⭐ MAIN' : ''}`);
  }

  // Auth users
  const authUsers = await q("SELECT email FROM auth.users ORDER BY email");
  console.log(`\n🔐 Auth users: ${authUsers.length} (${authUsers.map(u => u.email).join(', ')})`);

  // Products
  const products = await q('SELECT COUNT(*)::int AS c FROM products');
  console.log(`\n📦 Products: ${products[0]?.c || 0}`);

  // Customers
  const customers = await q('SELECT COUNT(*)::int AS c FROM customers');
  console.log(`👥 Customers: ${customers[0]?.c || 0}`);

  // Suppliers
  const suppliers = await q('SELECT COUNT(*)::int AS c FROM suppliers');
  console.log(`🏭 Suppliers: ${suppliers[0]?.c || 0}`);

  // Inventory
  const inv = await q('SELECT COUNT(*)::int AS c, SUM(quantity)::int AS total FROM inventory');
  console.log(`📋 Inventory items: ${inv[0]?.c || 0} (${inv[0]?.total || 0} total units)`);

  console.log('\n✅ Verification complete!');
}

main().catch(e => console.error('Fatal:', e));
