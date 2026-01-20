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

    // Verify user is admin - use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'חסרים פרטי התחברות למערכת' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }

    // supabaseAdmin already created above

    // Get only distributors
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('role', 'distributor')
      .order('full_name')

    if (profilesError) {
      console.error('Error loading profiles:', profilesError)
      return NextResponse.json(
        { error: profilesError.message },
        { status: 500 }
      )
    }

    // Get distributor profiles
    const { data: distProfilesData, error: distProfilesError } = await supabaseAdmin
      .from('distributor_profiles')
      .select('*')

    if (distProfilesError) {
      console.error('Error loading distributor profiles:', distProfilesError)
    }

    // Get orders count per distributor
    const { data: ordersData, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('distributor_id, total_amount')

    if (ordersError) {
      console.error('Error loading orders:', ordersError)
    }

    // Aggregate orders
    const ordersByUser: Record<string, { count: number; total: number }> = {}
    ordersData?.forEach((order) => {
      if (!ordersByUser[order.distributor_id]) {
        ordersByUser[order.distributor_id] = { count: 0, total: 0 }
      }
      ordersByUser[order.distributor_id].count++
      ordersByUser[order.distributor_id].total += order.total_amount || 0
    })

    // Map distributor profiles
    const distProfilesMap: Record<string, any> = {}
    distProfilesData?.forEach((dp) => {
      distProfilesMap[dp.user_id] = dp
    })

    // Get team leaders for lookup
    const { data: teamLeadersData } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'team_leader')

    const teamLeadersMap: Record<string, { full_name: string }> = {}
    teamLeadersData?.forEach((tl) => {
      teamLeadersMap[tl.id] = { full_name: tl.full_name }
    })

    // Combine data
    const distributors = (profilesData || []).map((profile) => ({
      ...profile,
      team_leader: profile.team_leader_id ? teamLeadersMap[profile.team_leader_id] || null : null,
      distributor_profile: distProfilesMap[profile.id] || null,
      orders_count: ordersByUser[profile.id]?.count || 0,
      total_sales: ordersByUser[profile.id]?.total || 0,
    }))

    return NextResponse.json({ distributors })
  } catch (error: any) {
    console.error('Error listing distributors:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת מפיצים' },
      { status: 500 }
    )
  }
}
