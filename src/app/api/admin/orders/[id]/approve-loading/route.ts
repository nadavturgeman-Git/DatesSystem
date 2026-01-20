import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { approveOrderLoading } from '@/lib/skills/inventory/loading-approval'

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
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }

    const body = await request.json()
    const adminUserId = body.adminUserId || user.id

    // Approve loading
    const result = await approveOrderLoading(params.id, adminUserId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      palletsAffected: result.palletsAffected,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'שגיאה באישור טעינה' },
      { status: 500 }
    )
  }
}
