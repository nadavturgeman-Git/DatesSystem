import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { allocateFIFO } from '@/lib/skills/inventory/fifo';
import { calculateDistributorRate } from '@/lib/skills/commissions/calculator';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { items } = body; // items = [{ productId, quantity }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    // Process each item and get FIFO allocation
    const previewItems = [];
    let totalWeight = 0;
    let subtotal = 0;

    for (const item of items) {
      // Get product details
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();

      if (!product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 404 }
        );
      }

      // Get FIFO allocation plan
      const allocation = await allocateFIFO(item.productId, item.quantity);

      const itemTotal = item.quantity * product.price_per_kg;

      previewItems.push({
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        pricePerKg: product.price_per_kg,
        itemTotal,
        allocation: allocation.allocations,
        fullyFulfilled: allocation.fullyFulfilled,
        actualWeight: allocation.totalAllocated,
      });

      totalWeight += allocation.totalAllocated;
      subtotal += itemTotal;
    }

    // Calculate commission rate based on total weight
    const commissionRate = calculateDistributorRate(totalWeight);
    const commissionAmount = subtotal * (commissionRate / 100);
    const totalAmount = subtotal;

    return NextResponse.json({
      success: true,
      preview: {
        items: previewItems,
        totalWeight,
        subtotal,
        commissionRate,
        commissionAmount,
        totalAmount,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
