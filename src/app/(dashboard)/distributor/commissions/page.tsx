'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface Commission {
  id: string
  commission_type: 'distributor' | 'team_leader'
  payment_type: 'cash' | 'goods'
  base_amount: number
  commission_rate: number
  commission_amount: number
  product_id?: string
  product_quantity_kg?: number
  is_paid: boolean
  paid_at?: string
  created_at: string
  order?: {
    order_number: string
    total_amount: number
  }
  product?: {
    name: string
  }
}

interface SalesCycle {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

export default function DistributorCommissionsPage() {
  const supabase = createClient()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [activeCycle, setActiveCycle] = useState<SalesCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState({
    totalEarned: 0,
    totalPaid: 0,
    totalUnpaid: 0,
    currentTier: '15%',
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')

      // Get active sales cycle
      const { data: cycle } = await supabase
        .from('sales_cycles')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .single()

      if (cycle) setActiveCycle(cycle)

      // Get commissions
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select(`
          *,
          order:orders(order_number, total_amount),
          product:products(name)
        `)
        .eq('user_id', user.id)
        .eq('commission_type', 'distributor')
        .order('created_at', { ascending: false })

      if (commissionsError) throw commissionsError

      setCommissions(commissionsData || [])

      // Calculate summary
      const totalEarned = commissionsData?.reduce((sum, c) => sum + c.commission_amount, 0) || 0
      const totalPaid = commissionsData?.filter(c => c.is_paid).reduce((sum, c) => sum + c.commission_amount, 0) || 0
      const totalUnpaid = totalEarned - totalPaid

      // Get current cycle weight to determine tier
      let currentTier = '15%'
      if (cycle) {
        const { data: metrics } = await supabase
          .from('performance_metrics')
          .select('total_weight_kg')
          .eq('distributor_id', user.id)
          .eq('sales_cycle_start', cycle.start_date)
          .single()

        const weight = metrics?.total_weight_kg || 0
        if (weight >= 75) {
          currentTier = '20%'
        } else if (weight >= 50) {
          currentTier = '17%'
        }
      }

      setSummary({
        totalEarned,
        totalPaid,
        totalUnpaid,
        currentTier,
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">מעקב עמלות</h1>
        <p className="text-gray-600">עמלות והכנסות לפי מחזור מכירות</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ הרווחתי</h3>
          <p className="text-3xl font-bold">₪{summary.totalEarned.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">שולם</h3>
          <p className="text-3xl font-bold">₪{summary.totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">ממתין לתשלום</h3>
          <p className="text-3xl font-bold">₪{summary.totalUnpaid.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">דרגת עמלה נוכחית</h3>
          <p className="text-3xl font-bold">{summary.currentTier}</p>
        </div>
      </div>

      {/* Active Cycle */}
      {activeCycle && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">מחזור מכירות פעיל</h3>
          <p className="text-blue-800">
            {activeCycle.name} - מ-{new Date(activeCycle.start_date).toLocaleDateString('he-IL')} עד{' '}
            {new Date(activeCycle.end_date).toLocaleDateString('he-IL')}
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Commissions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">היסטוריית עמלות</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  תאריך
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  הזמנה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  בסיס
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  שיעור
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  עמלה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סוג תשלום
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    אין עמלות עדיין
                  </td>
                </tr>
              ) : (
                commissions.map((commission) => (
                  <tr key={commission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(commission.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {commission.order?.order_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{commission.base_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {commission.commission_rate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {commission.payment_type === 'goods' && commission.product_quantity_kg
                        ? `${commission.product_quantity_kg} ק&quot;ג ${commission.product?.name || ''}`
                        : `₪${commission.commission_amount.toLocaleString()}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          commission.payment_type === 'goods'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {commission.payment_type === 'goods' ? 'מוצרים' : 'מזומן'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          commission.is_paid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {commission.is_paid ? 'שולם' : 'ממתין'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
