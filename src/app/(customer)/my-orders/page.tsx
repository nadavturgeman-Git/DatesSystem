'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Order {
  id: string
  order_number: string
  status: string
  payment_status: string
  delivery_status: string
  total_weight_kg: number
  total_amount: number
  created_at: string
  distributor?: {
    full_name: string
    phone?: string
  } | null
}

export default function CustomerOrdersPage() {
  const supabase = createClient()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadOrders()
  }, [])

  async function loadOrders() {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/my-orders')
        return
      }

      // Get orders via API (bypasses RLS and handles customer/distributor matching)
      const response = await fetch('/api/my-orders/list')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת הזמנות')
      }

      console.log('Orders loaded:', data.orders?.length || 0, data.orders)

      // Transform the data to match the Order interface
      const ordersData = (data.orders || []).map((order: any) => {
        const transformed = {
          id: order.id,
          order_number: order.order_number || order.id,
          status: order.status,
          payment_status: order.payment_status,
          delivery_status: order.delivery_status || null,
          total_weight_kg: Number(order.total_weight_kg) || 0,
          total_amount: Number(order.total_amount) || 0,
          created_at: order.created_at,
          distributor: order.distributor || null,
        }
        console.log('Transformed order:', transformed)
        return transformed
      })

      console.log('Setting orders:', ordersData.length, 'orders:', ordersData)
      setOrders(ordersData)
      
      // Debug: Check state after setting
      setTimeout(() => {
        console.log('Orders state after set:', ordersData.length)
      }, 100)
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading orders:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (status: string, deliveryStatus?: string) => {
    if (deliveryStatus === 'Picked_up_by_Customer') {
      return 'נאסף'
    }
    if (deliveryStatus === 'Delivered_to_Distributor') {
      return 'מוכן לאיסוף'
    }
    if (deliveryStatus === 'In_Transit') {
      return 'בדרך'
    }
    switch (status) {
      case 'pending':
        return 'ממתין לאישור'
      case 'confirmed':
        return 'אושר'
      case 'packed':
        return 'ארוז'
      case 'shipped':
        return 'נשלח'
      case 'delivered':
        return 'נמסר'
      case 'cancelled':
        return 'בוטל'
      default:
        return status
    }
  }

  const getStatusColor = (status: string, deliveryStatus?: string) => {
    if (deliveryStatus === 'Picked_up_by_Customer') {
      return 'bg-green-100 text-green-800'
    }
    if (deliveryStatus === 'Delivered_to_Distributor') {
      return 'bg-emerald-100 text-emerald-800'
    }
    if (deliveryStatus === 'In_Transit') {
      return 'bg-blue-100 text-blue-800'
    }
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800'
      case 'packed':
        return 'bg-purple-100 text-purple-800'
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800'
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'ממתין לתשלום'
      case 'paid':
        return 'שולם'
      case 'failed':
        return 'נכשל'
      case 'refunded':
        return 'הוחזר'
      default:
        return status
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען הזמנות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Link
              href="/catalog"
              className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
            >
              ← חזרה לקטלוג
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">ההזמנות שלי</h1>
            <p className="text-gray-600 mt-1">עקוב אחר סטטוס ההזמנות שלך</p>
          </div>
          <Link
            href="/catalog"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            הזמן עכשיו
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">אין הזמנות עדיין</h3>
          <p className="text-gray-600 mb-6">התחל להזמין תמרים טריים</p>
          <Link
            href="/catalog"
            className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition"
          >
            עיין בקטלוג
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      הזמנה #{order.order_number}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        order.status,
                        order.delivery_status
                      )}`}
                    >
                      {getStatusText(order.status, order.delivery_status)}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.payment_status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {getPaymentStatusText(order.payment_status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">משקל כולל</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {order.total_weight_kg} ק&quot;ג
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">סכום כולל</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ₪{order.total_amount.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">תאריך הזמנה</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {new Date(order.created_at).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                  </div>

                  {order.distributor && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-1">נקודת איסוף</p>
                      <p className="font-semibold text-gray-900">{order.distributor.full_name}</p>
                      {order.distributor.phone && (
                        <p className="text-sm text-gray-600">{order.distributor.phone}</p>
                      )}
                    </div>
                  )}

                  {order.delivery_status === 'Delivered_to_Distributor' && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <p className="font-semibold text-emerald-900">ההזמנה מוכנה לאיסוף!</p>
                          <p className="text-sm text-emerald-700">
                            ניתן לאסוף את ההזמנה אצל {order.distributor?.full_name || 'המפיץ'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Report Fault button - only for picked up orders */}
                  {order.delivery_status === 'Picked_up_by_Customer' && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <Link
                        href={`/report-fault?orderId=${order.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition font-medium"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        דווח על תקלה
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
