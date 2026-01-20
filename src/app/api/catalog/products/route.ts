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

    // Get active products
    const { data: products, error: productsError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (productsError) {
      console.error('Error loading products:', productsError)
      return NextResponse.json(
        { error: productsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ products: products || [] })
  } catch (error: any) {
    console.error('Error loading products:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת מוצרים' },
      { status: 500 }
    )
  }
}
