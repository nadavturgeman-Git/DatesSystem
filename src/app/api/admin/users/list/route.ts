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

    // Verify user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'חסרים פרטי התחברות למערכת' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Get all profiles
    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .order('role')
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
      // Continue anyway
    }

    // Map distributor profiles
    const distProfilesMap: Record<string, any> = {}
    distProfilesData?.forEach((dp) => {
      distProfilesMap[dp.user_id] = dp
    })

    // Create a map of all profiles for team leader lookup
    const profilesMap: Record<string, any> = {}
    profilesData?.forEach((p) => {
      profilesMap[p.id] = p
    })

    // Combine data with team leader info
    const usersWithDetails = (profilesData || []).map((profile) => ({
      ...profile,
      team_leader: profile.team_leader_id ? profilesMap[profile.team_leader_id] : null,
      distributor_profile: distProfilesMap[profile.id] || null,
    }))

    return NextResponse.json({ users: usersWithDetails })
  } catch (error: any) {
    console.error('Error listing users:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת משתמשים' },
      { status: 500 }
    )
  }
}
