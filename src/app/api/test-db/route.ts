import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test 1: Check if warehouses table exists and get data
    const { data: warehouses, error: warehouseError } = await supabase
      .from('warehouses')
      .select('*')
      .limit(5);

    if (warehouseError) {
      return NextResponse.json(
        { error: 'Database query failed', details: warehouseError },
        { status: 500 }
      );
    }

    // Test 2: Check if products table exists
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .limit(5);

    if (productError) {
      return NextResponse.json(
        { error: 'Products query failed', details: productError },
        { status: 500 }
      );
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: '✅ Database connection successful!',
      data: {
        warehouses: warehouses || [],
        warehouseCount: warehouses?.length || 0,
        products: products || [],
        productCount: products?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Connection test failed', details: error.message },
      { status: 500 }
    );
  }
}
