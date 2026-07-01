/* eslint-disable no-console */
/**
 * Migration runner for receipt settings tables
 * Applies SQL migrations to Supabase database
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hohxhazfysfiuqizyvay.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaHhoYXpmeXNmaXVxaXp5dmF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4ODI2MCwiZXhwIjoyMDkwODY0MjYwfQ.glN546bRoFCyHjJ2VbeeLhXOt6Us5rr05OkU8eFJS-U';

// Create Supabase admin client
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function runMigration() {
  console.log('🔧 RECEIPT SETTINGS MIGRATION RUNNER\n');
  
  try {
    // Read the migration SQL
    const migrationSql = fs.readFileSync('./db-migrations.sql', 'utf-8');
    
    // Extract the receipt settings related SQL (lines 270-365)
    // We'll manually extract just the relevant parts
    const sqlStatements = [
      // Create business_settings table
      `
        CREATE TABLE IF NOT EXISTS business_settings (
          id UUID PRIMARY KEY,
          business_name VARCHAR(255) NOT NULL DEFAULT 'WINNMATT POS',
          phone_number VARCHAR(20),
          email VARCHAR(255),
          address TEXT,
          tax_pin VARCHAR(50),
          business_pin VARCHAR(50),
          receipt_footer_text TEXT,
          return_policy_text TEXT,
          thank_you_message TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `.trim(),
      
      // Create branch_receipt_settings table
      `
        CREATE TABLE IF NOT EXISTS branch_receipt_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          branch_id UUID NOT NULL UNIQUE REFERENCES branches(id) ON DELETE CASCADE,
          phone_number VARCHAR(20),
          email VARCHAR(255),
          address TEXT,
          receipt_header_text TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `.trim(),
      
      // Seed the singleton row
      `
        INSERT INTO business_settings (
          id,
          business_name,
          phone_number,
          email,
          address,
          tax_pin,
          business_pin,
          receipt_footer_text,
          return_policy_text,
          thank_you_message
        ) VALUES (
          'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
          'WINNMATT POS',
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          'Thank you for your purchase!',
          NULL,
          'Your business matters to us!'
        )
        ON CONFLICT (id) DO NOTHING
      `.trim(),
      
      // Enable RLS
      `ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY`.trim(),
      `ALTER TABLE branch_receipt_settings ENABLE ROW LEVEL SECURITY`.trim(),
      
      // RLS policies
      `
        CREATE POLICY "Enable read access for authenticated users" ON business_settings
          FOR SELECT USING (auth.role() = 'authenticated')
      `.trim(),
      
      `
        CREATE POLICY "Enable read access for authenticated users" ON branch_receipt_settings
          FOR SELECT USING (auth.role() = 'authenticated')
      `.trim(),
    ];
    
    console.log(`Executing ${sqlStatements.length} SQL statements...\n`);
    
    let successCount = 0;
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      const statementNum = i + 1;
      
      try {
        console.log(`[${statementNum}/${sqlStatements.length}] Executing...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement,
        });
        
        if (error) {
          // If exec_sql RPC doesn't exist, the error will be different
          if (error.message.includes('Could not find the function')) {
            console.log(`   ⚠️  exec_sql RPC not found, trying direct execution...`);
            // Try using query instead
            const result = await supabase.from('_sql_direct').select('*');
            throw new Error('Need manual SQL execution via Supabase dashboard');
          }
          throw error;
        }
        
        console.log(`   ✅ Success`);
        successCount++;
        
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        console.log(`      SQL: ${statement.substring(0, 80)}...`);
      }
    }
    
    console.log(`\n✅ Executed ${successCount}/${sqlStatements.length} statements`);
    
    if (successCount < sqlStatements.length) {
      console.log('\n⚠️  ROLLBACK NEEDED - Some statements failed');
      console.log('\n🔧 AUTOMATIC EXECUTION FAILED');
      console.log('━'.repeat(60));
      console.log('The Supabase admin API doesn\'t support direct SQL execution.');
      console.log('\n✨ MANUAL STEPS NEEDED:');
      console.log('1. Go to: https://app.supabase.com');
      console.log('2. Select project: hohxhazfysfiuqizyvay');
      console.log('3. Go to SQL Editor');
      console.log('4. Click "New Query"');
      console.log('5. Copy SQL from db-migrations.sql (lines 270-365)');
      console.log('6. Paste and execute');
      console.log('\nOR use Supabase CLI:');
      console.log('→ supabase db pull');
      console.log('→ supabase db push');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    console.log('\n🔧 AUTOMATIC EXECUTION FAILED');
    console.log('━'.repeat(60));
    console.log('The Supabase JavaScript client API doesn\'t support direct SQL.');
    console.log('\n✨ MANUAL STEPS NEEDED:');
    console.log('1. Go to: https://app.supabase.com');
    console.log('2. Select project: hohxhazfysfiuqizyvay');
    console.log('3. Go to SQL Editor');
    console.log('4. Click "New Query"');
    console.log('5. Copy SQL from db-migrations.sql (lines 270-365)');
    console.log('6. Paste and execute');
    console.log('\nOR use Supabase CLI from project root:');
    console.log('→ supabase db pull    (syncs remote schema)');
    console.log('→ supabase db push    (applies local migrations)');
    console.log('\nDirect SQL:');
    console.log('```sql');
    console.log(sqlStatements.slice(0, 3).join(';\n') + ';');
    console.log('...');
    console.log('```');
    
    return false;
  }
}

runMigration().then(success => {
  process.exit(success ? 0 : 1);
});
