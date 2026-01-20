import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function verifyImplementation() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🧪 TESTING IMPLEMENTATION\n');
    console.log('='.repeat(60));
    await client.connect();
    console.log('✅ Connected to database\n');

    // Test 1: Employment Model ENUM
    console.log('📋 Test 1: Employment Model ENUM (4 values)');
    const enumResult = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      WHERE enumtypid = 'employment_model'::regtype
      ORDER BY enumsortorder;
    `);
    console.log('   Values:', enumResult.rows.map(r => r.enumlabel).join(', '));
    const hasPayslip = enumResult.rows.some(r => r.enumlabel === 'Payslip');
    const hasPrivateBusiness = enumResult.rows.some(r => r.enumlabel === 'Private_Business');
    console.log(`   ✅ Payslip: ${hasPayslip ? 'EXISTS' : '❌ MISSING'}`);
    console.log(`   ✅ Private_Business: ${hasPrivateBusiness ? 'EXISTS' : '❌ MISSING'}`);
    console.log('');

    // Test 2: Customers Table CRM Fields
    console.log('📋 Test 2: Customers Table CRM Fields');
    const customersColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'customers'
      AND column_name IN ('total_orders', 'lifetime_value', 'last_order_date', 'customer_id')
      ORDER BY column_name;
    `);
    console.log('   CRM Fields:');
    customersColumns.rows.forEach(row => {
      console.log(`   - ${row.column_name} (${row.data_type})`);
    });

    // Check phone unique constraint
    const phoneConstraint = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'customers'
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%phone%';
    `);
    console.log(`   ✅ Phone Unique Constraint: ${phoneConstraint.rows.length > 0 ? 'EXISTS' : '❌ MISSING'}`);
    console.log('');

    // Test 3: Orders Table - customer_id Column
    console.log('📋 Test 3: Orders Table - customer_id Link');
    const orderCustomerIdColumn = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      AND column_name = 'customer_id';
    `);
    if (orderCustomerIdColumn.rows.length > 0) {
      console.log(`   ✅ customer_id column: EXISTS (${orderCustomerIdColumn.rows[0].data_type})`);
    } else {
      console.log('   ❌ customer_id column: MISSING');
    }
    console.log('');

    // Test 4: Team Leader RLS Policy on Returns
    console.log('📋 Test 4: Team Leader RLS Policy on Returns');
    const rlsPolicyResult = await client.query(`
      SELECT policyname, cmd, qual
      FROM pg_policies
      WHERE tablename = 'returns'
      AND policyname LIKE '%Team Leader%';
    `);
    if (rlsPolicyResult.rows.length > 0) {
      console.log('   ✅ Team Leader Policy: EXISTS');
      console.log(`   Policy: ${rlsPolicyResult.rows[0].policyname}`);
      const hasTeamLeader = rlsPolicyResult.rows[0].qual.includes('team_leader');
      console.log(`   ✅ Includes team_leader role: ${hasTeamLeader ? 'YES' : 'NO'}`);
    } else {
      console.log('   ❌ Team Leader Policy: MISSING');
    }
    console.log('');

    // Test 5: Distributor Profiles - employment_model Column
    console.log('📋 Test 5: Distributor Profiles - employment_model Column');
    const distributorProfilesColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'distributor_profiles'
      AND column_name = 'employment_model';
    `);
    if (distributorProfilesColumns.rows.length > 0) {
      console.log(`   ✅ employment_model column: EXISTS`);

      // Check if any distributors have the new settlement profiles
      const distributorCount = await client.query(`
        SELECT employment_model, COUNT(*) as count
        FROM distributor_profiles
        WHERE employment_model IS NOT NULL
        GROUP BY employment_model;
      `);
      if (distributorCount.rows.length > 0) {
        console.log('   Current Distributor Settlement Profiles:');
        distributorCount.rows.forEach(row => {
          console.log(`   - ${row.employment_model}: ${row.count} distributor(s)`);
        });
      } else {
        console.log('   ℹ️  No distributors with settlement profiles yet');
      }
    } else {
      console.log('   ❌ employment_model column: MISSING');
    }
    console.log('');

    console.log('='.repeat(60));
    console.log('🎉 DATABASE VERIFICATION COMPLETE\n');

  } catch (error: any) {
    console.error('❌ Verification Failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyImplementation();
