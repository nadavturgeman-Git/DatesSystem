import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'חסרים פרטי התחברות למערכת' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Get user profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role, email, phone')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ orders: [] })
    }

    // Get orders based on user role
    let ordersQuery = supabaseAdmin
      .from('orders')
      .select(`
        *,
        distributor:profiles!orders_distributor_id_fkey(full_name, phone)
      `)
      .order('created_at', { ascending: false })

    if (profile.role === 'distributor') {
      // Show orders for this distributor
      ordersQuery = ordersQuery.eq('distributor_id', profile.id)
    } else {
      // For customers/admins, try multiple strategies to find their orders
      // Strategy 1: Check if there's a customer record
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('hub_coordinator_id')
        .or(`email.eq.${user.email || ''},phone.eq.${user.phone || ''}`)
        .maybeSingle()

      if (customer?.hub_coordinator_id) {
        // Found customer record - show orders for their coordinator
        ordersQuery = ordersQuery.eq('distributor_id', customer.hub_coordinator_id)
      } else if (profile.role === 'admin') {
        // Admin without customer record - show recent orders (last 7 days)
        // This handles the case where admin creates orders as a customer
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        ordersQuery = ordersQuery.gte('created_at', weekAgo.toISOString())
      } else {
        // Regular customer without record - show recent orders (last 24 hours)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        ordersQuery = ordersQuery.gte('created_at', yesterday.toISOString())
      }
    }

    const { data: orders, error: ordersError } = await ordersQuery

    if (ordersError) {
      console.error('Error loading orders:', ordersError)
      return NextResponse.json(
        { error: ordersError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ orders: orders || [] })
  } catch (error: any) {
    console.error('Error loading orders:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת הזמנות' },
      { status: 500 }
    )
  }
}
