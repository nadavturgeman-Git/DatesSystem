'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface PendingOrder {
  orderId: string
  orderNumber: string
  distributorName: string
  totalWeightKg: number
  totalAmount: number
  paidAt: string
  paymentMethod: string
}

export default function AdminLoadingApprovalPage() {
  const supabase = createClient()
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPendingOrders()
  }, [])

  async function loadPendingOrders() {
    setLoading(true)
    setError('')
    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_weight_kg,
          total_amount,
          paid_at,
          payment_method,
          profiles:distributor_id(full_name)
        `)
        .eq('payment_status', 'paid')
        .is('loading_approved_at', null)
        .neq('status', 'cancelled')
        .order('paid_at', { ascending: true })

      if (ordersError) throw ordersError

      const formatted = orders?.map(order => ({
        orderId: order.id,
        orderNumber: order.order_number,
        distributorName: (order.profiles as any)?.full_name || 'לא ידוע',
        totalWeightKg: order.total_weight_kg,
        totalAmount: order.total_amount,
        paidAt: order.paid_at,
        paymentMethod: order.payment_method || 'unknown',
      })) || []

      setPendingOrders(formatted)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function approveLoading(orderId: string) {
    if (!confirm('האם אתה בטוח שברצונך לאשר טעינה להזמנה זו? המלאי הפיזי יופחת.')) {
      return
    }

    setApproving(orderId)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')

      const response = await fetch(`/api/admin/orders/${orderId}/approve-loading`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminUserId: user.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה באישור טעינה')
      }

      // Reload list
      await loadPendingOrders()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setApproving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען הזמנות...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">אישור טעינה</h1>
        <p className="text-gray-600">
          הזמנות ששולמו וממתינות לאישור טעינה. המלאי הפיזי יופחת רק לאחר אישור.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Pending Orders */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            הזמנות ממתינות ({pendingOrders.length})
          </h2>
        </div>
        {pendingOrders.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            אין הזמנות ממתינות לאישור טעינה
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    מספר הזמנה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    מפיץ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    משקל
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    סכום
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    תאריך תשלום
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    פעולה
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingOrders.map((order) => (
                  <tr key={order.orderId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.distributorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.totalWeightKg.toFixed(2)} ק&quot;ג
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{order.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(order.paidAt).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => approveLoading(order.orderId)}
                        disabled={approving === order.orderId}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                          approving === order.orderId
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {approving === order.orderId ? 'מאשר...' : 'אשר טעינה'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
