import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get warehouses
    const { data: warehouses } = await supabase.from('warehouses').select('*');
    const baqaaWarehouse = warehouses?.find(w => w.warehouse_type === 'freezing');
    const jerusalemWarehouse = warehouses?.find(w => w.warehouse_type === 'cooling');

    // Get products
    const { data: products } = await supabase.from('products').select('*');
    const medjool = products?.find(p => p.variety === 'Medjool');
    const deglet = products?.find(p => p.variety === 'Deglet Noor');
    const barhi = products?.find(p => p.variety === 'Barhi');

    // Create test pallets with different entry dates (for FIFO demonstration)
    const pallets = [
      // Baqaa Warehouse - Medjool (older pallets)
      {
        pallet_id: 'PLT-MED-001',
        warehouse_id: baqaaWarehouse?.id,
        product_id: medjool?.id,
        initial_weight_kg: 500,
        current_weight_kg: 500,
        entry_date: new Date('2026-01-01'),
        expiry_date: new Date('2027-01-01'),
        batch_number: 'MED-2026-001',
      },
      {
        pallet_id: 'PLT-MED-002',
        warehouse_id: baqaaWarehouse?.id,
        product_id: medjool?.id,
        initial_weight_kg: 750,
        current_weight_kg: 750,
        entry_date: new Date('2026-01-05'),
        expiry_date: new Date('2027-01-05'),
        batch_number: 'MED-2026-002',
      },
      {
        pallet_id: 'PLT-MED-003',
        warehouse_id: baqaaWarehouse?.id,
        product_id: medjool?.id,
        initial_weight_kg: 600,
        current_weight_kg: 600,
        entry_date: new Date('2026-01-10'),
        expiry_date: new Date('2027-01-10'),
        batch_number: 'MED-2026-003',
      },

      // Baqaa Warehouse - Deglet Noor
      {
        pallet_id: 'PLT-DEG-001',
        warehouse_id: baqaaWarehouse?.id,
        product_id: deglet?.id,
        initial_weight_kg: 800,
        current_weight_kg: 800,
        entry_date: new Date('2026-01-03'),
        expiry_date: new Date('2027-01-03'),
        batch_number: 'DEG-2026-001',
      },
      {
        pallet_id: 'PLT-DEG-002',
        warehouse_id: baqaaWarehouse?.id,
        product_id: deglet?.id,
        initial_weight_kg: 900,
        current_weight_kg: 900,
        entry_date: new Date('2026-01-08'),
        expiry_date: new Date('2027-01-08'),
        batch_number: 'DEG-2026-002',
      },

      // Jerusalem Warehouse - Barhi (for immediate delivery)
      {
        pallet_id: 'PLT-BAR-001',
        warehouse_id: jerusalemWarehouse?.id,
        product_id: barhi?.id,
        initial_weight_kg: 300,
        current_weight_kg: 300,
        entry_date: new Date('2026-01-11'),
        expiry_date: new Date('2026-02-11'),
        batch_number: 'BAR-2026-001',
      },
      {
        pallet_id: 'PLT-BAR-002',
        warehouse_id: jerusalemWarehouse?.id,
        product_id: barhi?.id,
        initial_weight_kg: 400,
        current_weight_kg: 400,
        entry_date: new Date('2026-01-12'),
        expiry_date: new Date('2026-02-12'),
        batch_number: 'BAR-2026-002',
      },
    ];

    // Insert pallets
    const { data: insertedPallets, error } = await supabase
      .from('pallets')
      .insert(pallets)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate total inventory
    const totalInventory = insertedPallets?.reduce(
      (sum, p) => sum + p.current_weight_kg,
      0
    );

    return NextResponse.json({
      success: true,
      message: '✅ Test inventory created successfully!',
      data: {
        palletsCreated: insertedPallets?.length,
        totalInventoryKg: totalInventory,
        breakdown: {
          medjool: insertedPallets?.filter(p => p.product_id === medjool?.id).length,
          degletNoor: insertedPallets?.filter(p => p.product_id === deglet?.id).length,
          barhi: insertedPallets?.filter(p => p.product_id === barhi?.id).length,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
