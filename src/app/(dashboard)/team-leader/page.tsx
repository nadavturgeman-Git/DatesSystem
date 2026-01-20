'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DistributorPerformance {
  id: string
  full_name: string
  email: string
  phone?: string
  total_weight_kg: number
  total_orders: number
  total_revenue: number
  payment_status: 'paid' | 'pending' | 'mixed'
  met_50kg_threshold: boolean
  current_cycle_weight: number
}

interface SalesCycle {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  minimum_order_kg: number
}

export default function TeamLeaderDashboard() {
  const supabase = createClient()
  const [distributors, setDistributors] = useState<DistributorPerformance[]>([])
  const [activeCycle, setActiveCycle] = useState<SalesCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('לא מחובר')

      // Get active sales cycle
      const { data: cycles, error: cycleError } = await supabase
        .from('sales_cycles')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false })
        .limit(1)
        .single()

      if (cycleError && cycleError.code !== 'PGRST116') throw cycleError
      if (cycles) setActiveCycle(cycles)

      // Get distributors assigned to this team leader
      const { data: distributorProfiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('team_leader_id', user.id)
        .eq('role', 'distributor')

      if (profileError) throw profileError

      if (!distributorProfiles || distributorProfiles.length === 0) {
        setDistributors([])
        setLoading(false)
        return
      }

      const distributorIds = distributorProfiles.map(d => d.id)

      // Get performance metrics for current cycle
      const cycleStart = cycles?.start_date || new Date().toISOString().split('T')[0]
      const cycleEnd = cycles?.end_date || new Date().toISOString().split('T')[0]

      const { data: metrics, error: metricsError } = await supabase
        .from('performance_metrics')
        .select('*')
        .in('distributor_id', distributorIds)
        .eq('sales_cycle_start', cycleStart)

      if (metricsError) throw metricsError

      // Get orders for payment status
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('distributor_id, payment_status, subtotal')
        .in('distributor_id', distributorIds)
        .gte('created_at', cycleStart)
        .lte('created_at', cycleEnd)
        .neq('status', 'cancelled')

      if (ordersError) throw ordersError

      // Aggregate data
      const performanceMap = new Map<string, DistributorPerformance>()

      // Initialize from profiles
      distributorProfiles.forEach(profile => {
        performanceMap.set(profile.id, {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone || undefined,
          total_weight_kg: 0,
          total_orders: 0,
          total_revenue: 0,
          payment_status: 'pending',
          met_50kg_threshold: false,
          current_cycle_weight: 0,
        })
      })

      // Add metrics data
      metrics?.forEach(metric => {
        const perf = performanceMap.get(metric.distributor_id)
        if (perf) {
          perf.total_weight_kg = metric.total_weight_kg || 0
          perf.total_orders = metric.total_orders || 0
          perf.total_revenue = metric.total_revenue || 0
          perf.met_50kg_threshold = metric.met_minimum_threshold || false
          perf.current_cycle_weight = metric.total_weight_kg || 0
        }
      })

      // Add order payment status
      const paymentStatusMap = new Map<string, Set<string>>()
      orders?.forEach(order => {
        if (!paymentStatusMap.has(order.distributor_id)) {
          paymentStatusMap.set(order.distributor_id, new Set())
        }
        paymentStatusMap.get(order.distributor_id)?.add(order.payment_status)
      })

      paymentStatusMap.forEach((statuses, distributorId) => {
        const perf = performanceMap.get(distributorId)
        if (perf) {
          if (statuses.has('paid') && statuses.has('pending')) {
            perf.payment_status = 'mixed'
          } else if (statuses.has('paid')) {
            perf.payment_status = 'paid'
          } else {
            perf.payment_status = 'pending'
          }
        }
      })

      setDistributors(Array.from(performanceMap.values()))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = distributors.reduce((sum, d) => sum + d.total_weight_kg, 0)
  const totalRevenue = distributors.reduce((sum, d) => sum + d.total_revenue, 0)
  const metThreshold = distributors.filter(d => d.met_50kg_threshold).length
  const pendingPayments = distributors.filter(d => d.payment_status === 'pending' || d.payment_status === 'mixed').length

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">לוח בקרה - ראש צוות</h1>
        <p className="text-gray-600">ניטור אזורי - מעקב אחר מפיצים</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ משקל</h3>
          <p className="text-3xl font-bold">{totalWeight.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-1">ק&quot;ג</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ הכנסות</h3>
          <p className="text-3xl font-bold">₪{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">עמדו ב-50 ק&quot;ג</h3>
          <p className="text-3xl font-bold">{metThreshold}/{distributors.length}</p>
          <p className="text-xs opacity-75 mt-1">מפיצים</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">תשלומים ממתינים</h3>
          <p className="text-3xl font-bold">{pendingPayments}</p>
          <p className="text-xs opacity-75 mt-1">מפיצים</p>
        </div>
      </div>

      {/* Active Cycle Info */}
      {activeCycle && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">מחזור מכירות פעיל</h3>
          <p className="text-blue-800">
            {activeCycle.name} - מ-{new Date(activeCycle.start_date).toLocaleDateString('he-IL')} עד{' '}
            {new Date(activeCycle.end_date).toLocaleDateString('he-IL')}
          </p>
          <p className="text-sm text-blue-700 mt-1">מינימום: {activeCycle.minimum_order_kg} ק&quot;ג</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Distributors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">מפיצים באזור שלי</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מפיץ
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  משקל (ק&quot;ג)
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  הזמנות
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  הכנסות
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס תשלום
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  50 ק&quot;ג
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {distributors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    אין מפיצים מוקצים
                  </td>
                </tr>
              ) : (
                distributors.map((distributor) => (
                  <tr key={distributor.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{distributor.full_name}</div>
                        <div className="text-sm text-gray-500">{distributor.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {distributor.total_weight_kg.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {distributor.total_orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{distributor.total_revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          distributor.payment_status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : distributor.payment_status === 'mixed'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {distributor.payment_status === 'paid'
                          ? 'שולם'
                          : distributor.payment_status === 'mixed'
                          ? 'חלקי'
                          : 'ממתין'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {distributor.met_50kg_threshold ? (
                        <span className="text-green-600 font-semibold">✓</span>
                      ) : (
                        <span className="text-red-600 font-semibold">
                          {distributor.current_cycle_weight < 50
                            ? `${(50 - distributor.current_cycle_weight).toFixed(1)} ק"ג חסר`
                            : '✗'}
                        </span>
                      )}
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
