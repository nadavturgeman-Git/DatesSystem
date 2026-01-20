import { getPaymentUIConfig } from '@/lib/skills/payments/hybrid-payment-workflow'
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

    const config = await getPaymentUIConfig(distributorId)
    return NextResponse.json(config)
  } catch (error: any) {
    console.error('Error getting payment config:', error)
    return NextResponse.json(
      { error: error.message || 'שגיאה בטעינת הגדרות תשלום' },
      { status: 500 }
    )
  }
}
