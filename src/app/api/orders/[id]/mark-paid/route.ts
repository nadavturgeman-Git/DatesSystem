import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { confirmCashPayment } from '@/lib/skills/payments/hybrid-payment-workflow'

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
      .select('*, distributor_profiles:distributor_id!inner(employment_model)')
      .eq('id', params.id)
      .eq('distributor_id', user.id)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'הזמנה לא נמצאה או שאין לך הרשאה' },
        { status: 404 }
      )
    }

    // Check if payment is already paid
    if (order.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'הזמנה כבר שולמה' },
        { status: 400 }
      )
    }

    // Check if distributor has Cash_Paybox model
    const distributorProfile = (order as any).distributor_profiles
    if (distributorProfile?.employment_model !== 'Cash_Paybox') {
      return NextResponse.json(
        { error: 'פעולה זו זמינה רק למפיצים עם מודל Cash_Paybox' },
        { status: 403 }
      )
    }

    // Mark payment as received
    const result = await confirmCashPayment(params.id, user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    })
  } catch (error: any) {
    console.error('Error marking order as paid:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בעדכון סטטוס התשלום' },
      { status: 500 }
    )
  }
}
