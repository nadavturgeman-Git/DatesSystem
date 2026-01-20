import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'חסרים פרטי התחברות למערכת' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Get available distributors with location
    const { data: distributors, error: distributorsError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, pickup_location, city')
      .eq('role', 'distributor')

    if (distributorsError) {
      console.error('Error loading distributors:', distributorsError)
      return NextResponse.json(
        { error: distributorsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ distributors: distributors || [] })
  } catch (error: any) {
    console.error('Error loading distributors:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת מפיצים' },
      { status: 500 }
    )
  }
}
