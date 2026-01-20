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

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // If admin, use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'חסרים פרטי התחברות למערכת' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Always use admin client for dashboard stats (to bypass RLS)
    // This ensures all users can see basic stats
    const client = supabaseAdmin

    // Get warehouses
    const { data: warehouses, error: warehousesError } = await client
      .from('warehouses')
      .select('*')
      .eq('is_active', true)

    if (warehousesError) {
      console.error('[Dashboard Stats] Warehouses error:', warehousesError)
    }

    // Get products
    const { data: products, error: productsError } = await client
      .from('products')
      .select('*')
      .eq('is_active', true)

    if (productsError) {
      console.error('[Dashboard Stats] Products error:', productsError)
    }

    // Get total inventory
    const { data: pallets, error: palletsError } = await client
      .from('pallets')
      .select('current_weight_kg')
      .eq('is_depleted', false)

    if (palletsError) {
      console.error('[Dashboard Stats] Pallets error:', palletsError)
    }

    const totalInventory = pallets?.reduce((sum, pallet) => sum + (Number(pallet.current_weight_kg) || 0), 0) || 0

    return NextResponse.json({
      warehouses: warehouses || [],
      products: products || [],
      totalInventory,
      palletsCount: pallets?.length || 0,
    })
  } catch (error: any) {
    console.error('Error loading dashboard stats:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת נתונים' },
      { status: 500 }
    )
  }
}
