import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { sql } from 'drizzle-orm'
import { cancelPayment, methodToProvider } from '@/lib/skills/checkout/payment-providers'
import { releaseReservations } from '@/lib/skills/locking/virtual-lock'

// Helper function to normalize Drizzle results
function getRows(result: any): any[] {
  if (Array.isArray(result)) return result;
  if (result?.rows && Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Refund API for completed credit card transactions
 * Handles full credit card reversals via payment provider
 */
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

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'אין הרשאה - רק מנהל יכול לבצע החזר' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { reason, refundAmount } = body

    // Get order details
    const orderResult = await db.execute(sql`
      SELECT
        id,
        order_number,
        distributor_id,
        payment_status,
        payment_method,
        total_amount,
        payment_transaction_id,
        status
      FROM orders
      WHERE id = ${params.id}::uuid
    `)

    const orderRows = getRows(orderResult)
    if (orderRows.length === 0) {
      return NextResponse.json(
        { error: 'הזמנה לא נמצאה' },
        { status: 404 }
      )
    }

    const order = orderRows[0]

    // Verify order is paid
    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'לא ניתן להחזיר הזמנה שלא שולמה' },
        { status: 400 }
      )
    }

    // Only process refunds for credit card payments
    if (order.payment_method !== 'credit_card' && order.payment_method !== 'bit') {
      return NextResponse.json(
        { error: 'החזר זמין רק לתשלומי אשראי/Bit' },
        { status: 400 }
      )
    }

    const transactionId = order.payment_transaction_id as string | null
    if (!transactionId) {
      return NextResponse.json(
        { error: 'מספר עסקה לא נמצא - לא ניתן לבצע החזר' },
        { status: 400 }
      )
    }

    // Attempt to refund via payment provider
    const provider = methodToProvider(order.payment_method as string)
    let refundSuccess = false

    try {
      // In production, this would call the actual payment provider's refund API
      // For now, we'll use the cancel function which should handle refunds
      refundSuccess = await cancelPayment(provider, transactionId)
    } catch (error: any) {
      console.error('Payment provider refund error:', error)
      // Continue with database update even if provider refund fails
      // Admin can manually process refund if needed
    }

    // Update order status
    await db.execute(sql`
      UPDATE orders
      SET
        payment_status = 'refunded',
        status = 'cancelled',
        notes = COALESCE(notes || E'\n', '') || ${`החזר: ${reason || 'החזר מלא'}. סכום: ₪${refundAmount || order.total_amount}. תאריך: ${new Date().toISOString()}`},
        updated_at = NOW()
      WHERE id = ${params.id}::uuid
    `)

    // Release any stock reservations
    await releaseReservations(params.id)

    // Create return record for tracking
    await db.execute(sql`
      INSERT INTO returns (
        order_id,
        distributor_id,
        reason,
        description,
        quantity_kg,
        refund_amount,
        applied_to_balance,
        is_approved,
        approved_by,
        approved_at
      )
      VALUES (
        ${params.id}::uuid,
        ${order.distributor_id}::uuid,
        'other',
        ${reason || 'החזר מלא דרך מנהל'},
        0, -- Quantity not applicable for full refunds
        ${refundAmount || order.total_amount},
        FALSE, -- Don't apply to balance for credit card refunds
        TRUE,
        ${user.id}::uuid,
        NOW()
      )
    `)

    return NextResponse.json({
      success: true,
      message: refundSuccess
        ? 'החזר בוצע בהצלחה דרך ספק התשלום'
        : 'הזמנה עודכנה להחזר. ייתכן שצריך לעבד החזר ידנית דרך ספק התשלום',
      refundAmount: refundAmount || order.total_amount,
      providerRefundSuccess: refundSuccess,
    })
  } catch (error: any) {
    console.error('Refund error:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בביצוע החזר' },
      { status: 500 }
    )
  }
}
