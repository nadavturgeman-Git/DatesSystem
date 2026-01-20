import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendPickupNotification } from '@/lib/skills/notifications/pickup-notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
    }

    // Verify user is distributor and owns this order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles:distributor_id(id, full_name)')
      .eq('id', params.id)
      .eq('distributor_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'הזמנה לא נמצאה או שאין לך הרשאה' },
        { status: 404 }
      )
    }

    // Check if already marked as received
    if (order.delivery_status === 'Delivered_to_Distributor') {
      return NextResponse.json(
        { error: 'הזמנה כבר סומנה כנתקבלה' },
        { status: 400 }
      )
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        delivery_status: 'Delivered_to_Distributor',
        status: 'delivered',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Send pickup notifications to customers
    // Get customers associated with this order
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .eq('hub_coordinator_id', user.id)

    if (!customersError && customers && customers.length > 0) {
      // Send notifications (mock implementation)
      for (const customer of customers) {
        if (customer.phone) {
          await sendPickupNotification({
            customerId: customer.id,
            customerPhone: customer.phone,
            customerName: customer.full_name,
            orderId: params.id,
            orderNumber: order.order_number,
            distributorName: order.profiles?.full_name || 'המפיץ',
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'הזמנה סומנה כנתקבלה והתראות נשלחו ללקוחות',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'שגיאה בעדכון הזמנה' },
      { status: 500 }
    )
  }
}
