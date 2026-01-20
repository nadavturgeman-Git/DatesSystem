/**
 * Demo Data Seeding Script
 * 
 * Creates all necessary data for running test scenarios:
 * - Warehouses (Baqaa Warehouse, Jerusalem Warehouse)
 * - Products (Medjool, Deglet Noor, Barhi)
 * - Users (Admin, Distributor, Team Leader, Customer)
 * - Initial inventory pallets
 * 
 * Run: npx tsx seed-demo-data.ts
 */

import { db } from './src/lib/db/client'
import { sql } from 'drizzle-orm'

interface SeedResult {
  success: boolean
  message: string
  data?: any
}

async function seedWarehouses(): Promise<SeedResult> {
  try {
    // Check if warehouses exist
    const existing = await db.execute(sql`
      SELECT id, name FROM warehouses WHERE name IN ('Baqaa Warehouse', 'Jerusalem Warehouse')
    `)
    
    if (existing.rows.length >= 2) {
      return {
        success: true,
        message: 'Warehouses already exist',
        data: existing.rows.map(r => ({ id: r.id, name: r.name }))
      }
    }
    
    // Create Baqaa Warehouse (freezing)
    const baqaaResult = await db.execute(sql`
      INSERT INTO warehouses (name, warehouse_type, location, capacity_kg, spoilage_alert_days, is_active)
      VALUES ('Baqaa Warehouse', 'freezing', 'Baqaa', 50000, NULL, TRUE)
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `)
    
    // Create Jerusalem Warehouse (cooling)
    const jerusalemResult = await db.execute(sql`
      INSERT INTO warehouses (name, warehouse_type, location, capacity_kg, spoilage_alert_days, is_active)
      VALUES ('Jerusalem Warehouse', 'cooling', 'Jerusalem', 10000, 7, TRUE)
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `)
    
    // Get both warehouses
    const warehouses = await db.execute(sql`
      SELECT id, name, warehouse_type FROM warehouses WHERE name IN ('Baqaa Warehouse', 'Jerusalem Warehouse')
    `)
    
    return {
      success: true,
      message: 'Warehouses created',
      data: warehouses.rows.map(r => ({ id: r.id, name: r.name, type: r.warehouse_type }))
    }
  } catch (error: any) {
    return { success: false, message: `Error creating warehouses: ${error.message}` }
  }
}

async function seedProducts(): Promise<SeedResult> {
  try {
    // Check if products exist
    const existing = await db.execute(sql`
      SELECT id, name, variety FROM products WHERE is_active = TRUE LIMIT 3
    `)
    
    if (existing.rows.length >= 3) {
      return {
        success: true,
        message: 'Products already exist',
        data: existing.rows.map(r => ({ id: r.id, name: r.name, variety: r.variety }))
      }
    }
    
    // Create products
    await db.execute(sql`
      INSERT INTO products (name, variety, price_per_kg, is_active)
      VALUES 
        ('Medjool Dates', 'Medjool', 45.00, TRUE),
        ('Deglet Noor Dates', 'Deglet Noor', 35.00, TRUE),
        ('Barhi Dates', 'Barhi', 40.00, TRUE)
      ON CONFLICT DO NOTHING
    `)
    
    const products = await db.execute(sql`
      SELECT id, name, variety, price_per_kg FROM products WHERE is_active = TRUE
    `)
    
    return {
      success: true,
      message: 'Products created',
      data: products.rows.map(r => ({ 
        id: r.id, 
        name: r.name, 
        variety: r.variety,
        price: r.price_per_kg 
      }))
    }
  } catch (error: any) {
    return { success: false, message: `Error creating products: ${error.message}` }
  }
}

async function seedUsers(): Promise<SeedResult> {
  try {
    // Note: This assumes you're using Supabase Auth
    // We'll create profiles that reference auth users
    // For demo, we'll check if profiles exist and create placeholder logic
    
    // Check for admin
    const adminCheck = await db.execute(sql`
      SELECT id, full_name, role FROM profiles WHERE role = 'admin' LIMIT 1
    `)
    
    // Check for distributor
    const distributorCheck = await db.execute(sql`
      SELECT id, full_name, role FROM profiles WHERE role = 'distributor' LIMIT 1
    `)
    
    // Check for team leader
    const teamLeaderCheck = await db.execute(sql`
      SELECT id, full_name, role FROM profiles WHERE role = 'team_leader' LIMIT 1
    `)
    
    const users = {
      admin: adminCheck.rows[0] ? { id: adminCheck.rows[0].id, name: adminCheck.rows[0].full_name } : null,
      distributor: distributorCheck.rows[0] ? { id: distributorCheck.rows[0].id, name: distributorCheck.rows[0].full_name } : null,
      teamLeader: teamLeaderCheck.rows[0] ? { id: teamLeaderCheck.rows[0].id, name: teamLeaderCheck.rows[0].full_name } : null,
    }
    
    if (users.admin && users.distributor) {
      return {
        success: true,
        message: 'Users already exist (you need to create them via Supabase Auth first)',
        data: users
      }
    }
    
    return {
      success: false,
      message: 'Users need to be created via Supabase Auth. See instructions below.',
      data: users
    }
  } catch (error: any) {
    return { success: false, message: `Error checking users: ${error.message}` }
  }
}

async function seedInitialInventory(): Promise<SeedResult> {
  try {
    // Get warehouses
    const warehouses = await db.execute(sql`
      SELECT id, name, warehouse_type FROM warehouses WHERE name IN ('Baqaa Warehouse', 'Jerusalem Warehouse')
    `)
    
    if (warehouses.rows.length < 2) {
      return { success: false, message: 'Warehouses not found. Run seedWarehouses first.' }
    }
    
    const baqaaWarehouse = warehouses.rows.find(w => w.name === 'Baqaa Warehouse')
    const jerusalemWarehouse = warehouses.rows.find(w => w.name === 'Jerusalem Warehouse')
    
    if (!baqaaWarehouse || !jerusalemWarehouse) {
      return { success: false, message: 'Required warehouses not found' }
    }
    
    // Get products
    const products = await db.execute(sql`
      SELECT id, name, variety FROM products WHERE is_active = TRUE
    `)
    
    if (products.rows.length < 3) {
      return { success: false, message: 'Products not found. Run seedProducts first.' }
    }
    
    const medjool = products.rows.find(p => p.variety === 'Medjool')
    const deglet = products.rows.find(p => p.variety === 'Deglet Noor')
    const barhi = products.rows.find(p => p.variety === 'Barhi')
    
    // Check if pallets already exist
    const existingPallets = await db.execute(sql`
      SELECT COUNT(*) as count FROM pallets WHERE pallet_id LIKE 'DEMO-%'
    `)
    
    const existingCount = Number(existingPallets.rows[0]?.count || 0)
    
    if (existingCount > 0) {
      return {
        success: true,
        message: `Demo pallets already exist (${existingCount})`,
        data: { existingCount }
      }
    }
    
    // Create demo pallets
    const pallets = [
      // Baqaa Warehouse - Medjool
      {
        pallet_id: 'DEMO-MED-001',
        warehouse_id: baqaaWarehouse.id,
        product_id: medjool?.id,
        initial_weight_kg: 500,
        current_weight_kg: 500,
        entry_date: new Date('2026-01-01'),
        expiry_date: new Date('2027-01-01'),
        batch_number: 'DEMO-MED-001',
      },
      {
        pallet_id: 'DEMO-MED-002',
        warehouse_id: baqaaWarehouse.id,
        product_id: medjool?.id,
        initial_weight_kg: 500,
        current_weight_kg: 500,
        entry_date: new Date('2026-01-05'),
        expiry_date: new Date('2027-01-05'),
        batch_number: 'DEMO-MED-002',
      },
      {
        pallet_id: 'DEMO-MED-003',
        warehouse_id: baqaaWarehouse.id,
        product_id: medjool?.id,
        initial_weight_kg: 500,
        current_weight_kg: 500,
        entry_date: new Date('2026-01-10'),
        expiry_date: new Date('2027-01-10'),
        batch_number: 'DEMO-MED-003',
      },
      // Jerusalem Warehouse - Barhi (fresh fruit)
      {
        pallet_id: 'DEMO-FRESH-001',
        warehouse_id: jerusalemWarehouse.id,
        product_id: barhi?.id,
        initial_weight_kg: 500,
        current_weight_kg: 500,
        entry_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        batch_number: 'DEMO-FRESH-001',
        is_fresh_fruit: true,
      },
    ]
    
    for (const pallet of pallets) {
      if (pallet.product_id) {
        await db.execute(sql`
          INSERT INTO pallets (
            pallet_id, warehouse_id, product_id, initial_weight_kg, current_weight_kg,
            entry_date, expiry_date, batch_number, is_fresh_fruit
          )
          VALUES (
            ${pallet.pallet_id},
            ${pallet.warehouse_id}::uuid,
            ${pallet.product_id}::uuid,
            ${pallet.initial_weight_kg},
            ${pallet.current_weight_kg},
            ${pallet.entry_date.toISOString()}::timestamptz,
            ${pallet.expiry_date.toISOString().split('T')[0]}::date,
            ${pallet.batch_number},
            ${pallet.is_fresh_fruit || false}
          )
          ON CONFLICT (pallet_id) DO NOTHING
        `)
      }
    }
    
    const createdPallets = await db.execute(sql`
      SELECT COUNT(*) as count FROM pallets WHERE pallet_id LIKE 'DEMO-%'
    `)
    
    return {
      success: true,
      message: 'Demo inventory created',
      data: { palletsCreated: Number(createdPallets.rows[0]?.count || 0) }
    }
  } catch (error: any) {
    return { success: false, message: `Error creating inventory: ${error.message}` }
  }
}

async function main() {
  console.log('🌱 Starting Demo Data Seeding...\n')
  console.log('='.repeat(60))
  
  const results: Array<{ step: string; result: SeedResult }> = []
  
  // Step 1: Warehouses
  console.log('\n1. Seeding Warehouses...')
  const warehousesResult = await seedWarehouses()
  results.push({ step: 'Warehouses', result: warehousesResult })
  console.log(warehousesResult.success ? '✅' : '❌', warehousesResult.message)
  if (warehousesResult.data) {
    console.log('   Data:', JSON.stringify(warehousesResult.data, null, 2))
  }
  
  // Step 2: Products
  console.log('\n2. Seeding Products...')
  const productsResult = await seedProducts()
  results.push({ step: 'Products', result: productsResult })
  console.log(productsResult.success ? '✅' : '❌', productsResult.message)
  if (productsResult.data) {
    console.log('   Data:', JSON.stringify(productsResult.data, null, 2))
  }
  
  // Step 3: Users
  console.log('\n3. Checking Users...')
  const usersResult = await seedUsers()
  results.push({ step: 'Users', result: usersResult })
  console.log(usersResult.success ? '✅' : '⚠️', usersResult.message)
  if (usersResult.data) {
    console.log('   Data:', JSON.stringify(usersResult.data, null, 2))
  }
  
  // Step 4: Initial Inventory
  console.log('\n4. Seeding Initial Inventory...')
  const inventoryResult = await seedInitialInventory()
  results.push({ step: 'Inventory', result: inventoryResult })
  console.log(inventoryResult.success ? '✅' : '❌', inventoryResult.message)
  if (inventoryResult.data) {
    console.log('   Data:', JSON.stringify(inventoryResult.data, null, 2))
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Seeding Summary:')
  const successful = results.filter(r => r.result.success).length
  const failed = results.filter(r => !r.result.success).length
  
  results.forEach(({ step, result }) => {
    const icon = result.success ? '✅' : '❌'
    console.log(`   ${icon} ${step}: ${result.message}`)
  })
  
  console.log(`\n✅ Successful: ${successful}/${results.length}`)
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${results.length}`)
  }
  
  // User creation instructions
  if (!usersResult.success || !usersResult.data?.admin || !usersResult.data?.distributor) {
    console.log('\n' + '='.repeat(60))
    console.log('\n👤 USER CREATION REQUIRED:')
    console.log('\nYou need to create users via Supabase Auth:')
    console.log('1. Go to Supabase Dashboard → Authentication → Users')
    console.log('2. Create users with these emails:')
    console.log('   - admin@datesystem.com (role: admin)')
    console.log('   - distributor@datesystem.com (role: distributor)')
    console.log('   - teamleader@datesystem.com (role: team_leader)')
    console.log('3. After creating users, create profiles:')
    console.log('   INSERT INTO profiles (id, full_name, role, email) VALUES')
    console.log('   (auth_user_id, \'Admin User\', \'admin\', \'admin@datesystem.com\'),')
    console.log('   (auth_user_id, \'Distributor User\', \'distributor\', \'distributor@datesystem.com\'),')
    console.log('   (auth_user_id, \'Team Leader User\', \'team_leader\', \'teamleader@datesystem.com\');')
  }
  
  console.log('\n✨ Seeding complete!\n')
  
  process.exit(failed > 0 ? 1 : 0)
}

if (require.main === module) {
  main().catch(console.error)
}

export { main, seedWarehouses, seedProducts, seedUsers, seedInitialInventory }
