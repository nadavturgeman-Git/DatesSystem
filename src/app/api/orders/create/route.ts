import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createReservations } from '@/lib/skills/locking/virtual-lock';

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();
    const { distributorId, items } = body;

    if (!distributorId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    // Calculate totals
    let totalWeight = 0;
    let subtotal = 0;
    const orderItemsData = [];

    for (const item of items) {
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

      const itemTotal = item.quantity * product.price_per_kg;
      totalWeight += item.quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        product_id: item.productId,
        quantity_kg: item.quantity,
        unit_price: product.price_per_kg,
        subtotal: itemTotal,
      });
    }

    // Calculate commission (simplified - you can use the calculator skill for more advanced logic)
    const commissionRate = totalWeight < 50 ? 15 : totalWeight < 75 ? 17 : 20;
    const commissionAmount = subtotal * (commissionRate / 100);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        distributor_id: distributorId,
        status: 'pending',
        payment_status: 'pending',
        total_weight_kg: totalWeight,
        subtotal: subtotal,
        commission_amount: commissionAmount,
        total_amount: subtotal,
        reservation_expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || 'Failed to create order' },
        { status: 500 }
      );
    }

    // Create order items
    const orderItemsWithOrderId = orderItemsData.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      return NextResponse.json(
        { error: 'Failed to create order items' },
        { status: 500 }
      );
    }

    // Create stock reservations using Virtual Lock skill
    for (const item of items) {
      const reservationResult = await createReservations({
        orderId: order.id,
        productId: item.productId,
        requestedWeight: item.quantity,
        timeoutMinutes: 30,
      });

      if (!reservationResult.success) {
        // If reservation fails, delete order and items
        await supabase.from('orders').delete().eq('id', order.id);
        return NextResponse.json(
          {
            error: `Failed to reserve stock for product. ${
              reservationResult.message || 'Insufficient inventory'
            }`,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order created successfully with 30-minute reservation',
      order: {
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: order.total_amount,
        commissionAmount: order.commission_amount,
        reservationExpiresAt: order.reservation_expires_at,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
