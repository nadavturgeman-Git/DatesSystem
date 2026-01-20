'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import Link from 'next/link'

interface Order {
  id: string
  order_number: string
  total_amount: number
  total_weight_kg: number
  status: string
  payment_status: string
  created_at: string
}

function OrderConfirmationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const orderId = searchParams.get('orderId')
  const distributorId = params.distributorId as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (orderId) {
      loadOrder()
    } else {
      setError('מספר הזמנה לא נמצא')
      setLoading(false)
    }
  }, [orderId])

  async function loadOrder() {
    if (!orderId) return

    try {
      const response = await fetch(`/api/orders/${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת הזמנה')
      }

      setOrder(data.order)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 text-lg font-semibold mb-2">שגיאה</p>
            <p className="text-red-600">{error || 'הזמנה לא נמצאה'}</p>
            <Link
              href={`/order/${distributorId}`}
              className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              חזרה להזמנה
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ההזמנה התקבלה בהצלחה!
          </h1>
          <p className="text-gray-600">
            מספר הזמנה: <span className="font-semibold">{order.order_number}</span>
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">פרטי ההזמנה</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">סטטוס:</span>
              <span className="font-semibold text-gray-900">
                {order.status === 'pending' ? 'ממתין לאישור' : order.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">סטטוס תשלום:</span>
              <span className="font-semibold text-gray-900">
                {order.payment_status === 'pending' ? 'ממתין לתשלום' : order.payment_status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">סה"כ משקל:</span>
              <span className="font-semibold text-gray-900">{order.total_weight_kg} ק"ג</span>
            </div>
            <div className="flex justify-between border-t pt-3">
              <span className="text-lg font-semibold text-gray-900">סה"כ לתשלום:</span>
              <span className="text-2xl font-bold text-emerald-600">
                ₪{order.total_amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">מה הלאה?</h3>
          <ul className="text-blue-800 space-y-2 text-sm list-disc list-inside">
            <li>ההזמנה נשמרה במערכת ונשלחה למפיץ</li>
            <li>המפיץ יצור איתך קשר בקרוב לאישור ההזמנה ותשלום</li>
            <li>תוכל לקבל עדכונים על סטטוס ההזמנה</li>
          </ul>
        </div>

        <div className="flex gap-4">
          <Link
            href={`/order/${distributorId}`}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold text-center"
          >
            הזמנה נוספת
          </Link>
          <Link
            href="/"
            className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold text-center"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  )
}
