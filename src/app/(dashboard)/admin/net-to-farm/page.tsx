'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface NetToFarmData {
  distributorId: string
  distributorName: string
  totalRevenue: number
  totalCommissions: number
  netToFarm: number
  orderCount: number
  settlementType: 'invoice_payslip' | 'group_discount'
}

export default function NetToFarmPage() {
  const supabase = createClient()
  const [data, setData] = useState<NetToFarmData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of month
    endDate: new Date().toISOString().split('T')[0], // Today
  })

  useEffect(() => {
    loadData()
  }, [dateRange])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      // Get all orders in date range
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          distributor_id,
          subtotal,
          commission_amount,
          total_amount,
          profiles:distributor_id(full_name),
          distributor_profiles:distributor_id(is_group_discount)
        `)
        .gte('created_at', dateRange.startDate)
        .lte('created_at', dateRange.endDate)
        .eq('payment_status', 'paid')
        .neq('status', 'cancelled')

      if (ordersError) throw ordersError

      // Get commissions with settlement type
      const { data: commissions, error: commissionsError } = await supabase
        .from('commissions')
        .select('order_id, commission_amount, settlement_type')
        .in('order_id', orders?.map(o => o.id) || [])

      if (commissionsError) throw commissionsError

      // Aggregate by distributor
      const distributorMap = new Map<string, NetToFarmData>()

      orders?.forEach((order: any) => {
        const distributorId = order.distributor_id
        const distributorName = order.profiles?.full_name || 'לא ידוע'
        const isGroupDiscount = order.distributor_profiles?.is_group_discount || false
        const settlementType = isGroupDiscount ? 'group_discount' : 'invoice_payslip'

        if (!distributorMap.has(distributorId)) {
          distributorMap.set(distributorId, {
            distributorId,
            distributorName,
            totalRevenue: 0,
            totalCommissions: 0,
            netToFarm: 0,
            orderCount: 0,
            settlementType,
          })
        }

        const data = distributorMap.get(distributorId)!
        data.totalRevenue += order.subtotal || 0
        data.totalCommissions += order.commission_amount || 0
        data.netToFarm = data.totalRevenue - data.totalCommissions
        data.orderCount += 1
      })

      setData(Array.from(distributorMap.values()))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0)
  const totalCommissions = data.reduce((sum, d) => sum + d.totalCommissions, 0)
  const totalNetToFarm = data.reduce((sum, d) => sum + d.netToFarm, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">נטו למשק</h1>
        <p className="text-gray-600">
          דוח פיננסי המחשב את הסכום הנקי שמגיע למשק לאחר ניכוי עמלות מפיצים
        </p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">טווח תאריכים</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              מתאריך
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              עד תאריך
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">סה&quot;כ הכנסות</h3>
          <p className="text-3xl font-bold text-gray-900">
            ₪{totalRevenue.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">סה&quot;כ עמלות</h3>
          <p className="text-3xl font-bold text-orange-600">
            ₪{totalCommissions.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-r-4 border-emerald-500">
          <h3 className="text-sm font-medium text-gray-500 mb-2">נטו למשק</h3>
          <p className="text-3xl font-bold text-emerald-600">
            ₪{totalNetToFarm.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Distributor Breakdown */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">פירוט לפי מפיץ</h2>
        </div>
        {data.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            אין נתונים לתקופה שנבחרה
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    מפיץ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    סוג הסדר
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    מספר הזמנות
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    סה&quot;כ הכנסות
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    עמלות
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    נטו למשק
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((item) => (
                  <tr key={item.distributorId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.distributorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          item.settlementType === 'group_discount'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {item.settlementType === 'group_discount'
                          ? 'הנחה קבוצתית'
                          : 'חשבונית/תלוש'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.orderCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{item.totalRevenue.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                      ₪{item.totalCommissions.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      ₪{item.netToFarm.toLocaleString('he-IL', { minimumFractionDigits: 2 })}
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
