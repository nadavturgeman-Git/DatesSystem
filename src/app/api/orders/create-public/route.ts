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
    const { distributorId, items, customerInfo, paymentMethod } = body;

    if (!distributorId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }

    if (!customerInfo || !customerInfo.full_name || !customerInfo.phone) {
      return NextResponse.json(
        { error: 'יש למלא שם וטלפון' },
        { status: 400 }
      );
    }

    // Verify distributor exists
    const { data: distributor, error: distributorError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', distributorId)
      .eq('role', 'distributor')
      .single();

    if (distributorError || !distributor) {
      return NextResponse.json(
        { error: 'מפיץ לא נמצא' },
        { status: 404 }
      );
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

    // Calculate commission (simplified)
    const commissionRate = totalWeight < 50 ? 15 : totalWeight < 75 ? 17 : 20;
    const commissionAmount = subtotal * (commissionRate / 100);

    // Lookup or create customer
    const normalizedPhone = customerInfo.phone.replace(/[\s-]/g, '');
    let customerId: string | null = null;

    // Try to find existing customer by phone
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, total_orders, lifetime_value')
      .eq('phone', normalizedPhone)
      .single();

    if (existingCustomer) {
      // Existing customer found
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          full_name: customerInfo.full_name,
          phone: normalizedPhone,
          email: customerInfo.email || null,
          total_orders: 0,
          lifetime_value: 0,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Failed to create customer:', customerError);
        // Continue without customer linkage if this fails
      } else if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // Create order with customer link
    const customerNotes = `לקוח: ${customerInfo.full_name}, טלפון: ${customerInfo.phone}${customerInfo.email ? `, אימייל: ${customerInfo.email}` : ''}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        distributor_id: distributorId,
        customer_id: customerId, // Link to customer for CRM tracking
        status: 'pending',
        payment_status: 'pending',
        payment_method: paymentMethod || 'cash', // Default to cash if not provided
        total_weight_kg: totalWeight,
        subtotal: subtotal,
        commission_amount: commissionAmount,
        total_amount: subtotal,
        notes: customerNotes,
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

    // Update customer stats (total_orders, last_order_date)
    // Note: lifetime_value will be updated when order is paid/confirmed
    if (customerId) {
      const { data: currentCustomer } = await supabase
        .from('customers')
        .select('total_orders, full_name, email')
        .eq('id', customerId)
        .single();

      if (currentCustomer) {
        await supabase
          .from('customers')
          .update({
            total_orders: (currentCustomer.total_orders || 0) + 1,
            last_order_date: new Date().toISOString(),
            // Update contact info if changed
            full_name: customerInfo.full_name,
            email: customerInfo.email || currentCustomer.email,
          })
          .eq('id', customerId);
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
    console.error('Error creating public order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
