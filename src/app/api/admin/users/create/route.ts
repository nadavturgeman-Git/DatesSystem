import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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

    // Create service role client for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'חסרים פרטי התחברות למערכת' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)

    const body = await request.json()
    const { email, password, full_name, phone, role, team_leader_id, employment_model, paybox_link, pickup_location, city } = body

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'חסרים שדות חובה: email, password, full_name, role' },
        { status: 400 }
      )
    }

    // Create auth user using admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
      },
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || 'שגיאה ביצירת משתמש' },
        { status: 500 }
      )
    }

    // Create profile using admin client
    console.log('Creating profile for user:', authData.user.id, { email, full_name, role })
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        phone: phone || null,
        role,
        team_leader_id: team_leader_id || null,
        pickup_location: pickup_location || null,
        city: city || null,
      })
      .select()
      .single()

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Rollback: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: `שגיאה ביצירת פרופיל: ${profileError.message}` },
        { status: 500 }
      )
    }
    console.log('Profile created successfully:', profileData)

    // Create distributor profile if role is distributor
    if (role === 'distributor') {
      const distProfileData: any = {
        user_id: authData.user.id,
        employment_model: employment_model || 'Credit_Commission',
        preferred_payment_method: 'cash',
      }
      if (paybox_link) {
        distProfileData.paybox_link = paybox_link
      }

      const { error: distProfileError } = await supabaseAdmin
        .from('distributor_profiles')
        .insert(distProfileData)

      if (distProfileError) {
        // Note: We don't rollback here - profile is already created
        console.error('Error creating distributor profile:', distProfileError)
        // Continue anyway - profile can be updated later
      }
    }

    return NextResponse.json({
      success: true,
      message: 'משתמש נוצר בהצלחה',
      userId: authData.user.id,
      profile: profileData,
    })
  } catch (error: any) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה ביצירת משתמש' },
      { status: 500 }
    )
  }
}
