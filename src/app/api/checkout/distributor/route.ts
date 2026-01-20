import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const distributorId = searchParams.get('distributorId')

    if (!distributorId) {
      return NextResponse.json(
        { error: 'חסר ID מפיץ' },
        { status: 400 }
      )
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

    const { data: distributor, error: distributorError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', distributorId)
      .single()

    if (distributorError) {
      console.error('Error loading distributor:', distributorError)
      return NextResponse.json(
        { error: distributorError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ distributor })
  } catch (error: any) {
    console.error('Error loading distributor:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת מפיץ' },
      { status: 500 }
    )
  }
}
