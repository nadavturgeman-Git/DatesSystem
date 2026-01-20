import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Normalize phone (remove spaces, dashes)
    const normalizedPhone = phone.replace(/[\s-]/g, '');

    // Lookup customer by phone
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is OK
      console.error('Customer lookup error:', error);
      return NextResponse.json(
        { error: 'Failed to lookup customer' },
        { status: 500 }
      );
    }

    if (!customer) {
      // Customer not found - this is OK for first-time customers
      return NextResponse.json({ customer: null }, { status: 200 });
    }

    // Customer found - return their data
    return NextResponse.json({
      customer: {
        id: customer.id,
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        total_orders: customer.total_orders,
        lifetime_value: customer.lifetime_value,
        last_order_date: customer.last_order_date,
      },
    });
  } catch (err: any) {
    console.error('Customer lookup error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
