'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OrderConfirmationPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const [order, setOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    try {
      // Get order via API (bypasses RLS)
      const response = await fetch(`/api/orders/${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת הזמנה')
      }

      setOrder(data.order)
      setOrderItems(data.orderItems || [])
    } catch (error: any) {
      console.error('Error loading order:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">הזמנה לא נמצאה</h1>
          <Link href="/my-orders" className="text-emerald-600 hover:text-emerald-700">
            חזור להזמנות שלי
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">ההזמנה בוצעה בהצלחה!</h1>
            <p className="text-gray-600">מספר הזמנה: {order.order_number || order.id}</p>
          </div>

          <div className="border-t border-gray-200 pt-6 mt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">פרטי ההזמנה</h2>
            <div className="space-y-3">
              {orderItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-900">{item.product?.name || 'מוצר'}</p>
                    <p className="text-sm text-gray-600">{item.quantity_kg} ק&quot;ג × ₪{item.unit_price}</p>
                  </div>
                  <p className="font-semibold text-gray-900">₪{item.subtotal?.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold text-gray-900">סה&quot;כ</p>
                <p className="text-2xl font-bold text-emerald-600">₪{order.total_amount?.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                <strong>הערה:</strong> ההזמנה שלך נשמרה במערכת. תקבל עדכון כאשר ההזמנה תהיה מוכנה לאיסוף.
              </p>
            </div>
            <div className="flex gap-4 justify-center">
              <Link
                href="/my-orders"
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
              >
                צפה בהזמנות שלי
              </Link>
              <Link
                href="/catalog"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                המשך לקניות
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
