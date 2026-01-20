'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  warehouses: any[]
  products: any[]
  totalInventory: number
  palletsCount: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [publicOrderLink, setPublicOrderLink] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    warehouses: [],
    products: [],
    totalInventory: 0,
    palletsCount: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      // Get user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      setProfile(profileData)

      // Set public order link for distributors
      if (profileData?.role === 'distributor') {
        const baseUrl = window.location.origin
        setPublicOrderLink(`${baseUrl}/order/${currentUser.id}`)
      }

      // Get stats via API (handles RLS properly)
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()

      console.log('[Dashboard] API Response:', { ok: response.ok, data })

      if (response.ok) {
        setStats(data)
      } else {
        console.error('Error loading stats:', data.error)
      }
    } catch (error: any) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתונים...</p>
        </div>
      </div>
    )
  }

  const { warehouses, products, totalInventory } = stats
  const isDistributor = profile?.role === 'distributor'

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      alert('הקישור הועתק ללוח!')
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        alert('הקישור הועתק ללוח!')
      } catch (err) {
        alert('לא ניתן להעתיק. אנא העתק ידנית.')
      }
      document.body.removeChild(textArea)
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              שלום, {profile?.full_name || user.email}!
            </h1>
            <p className="text-gray-600">
              תפקיד: <span className="font-semibold">{profile?.role === 'admin' ? 'מנהל' : profile?.role === 'team_leader' ? 'ראש צוות' : 'מפיץ'}</span>
            </p>
          </div>
          <Link
            href="/catalog"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition flex items-center gap-2"
          >
            🛒 קטלוג תמרים
          </Link>
        </div>
      </div>

      {/* Public Order Link for Distributors */}
      {isDistributor && publicOrderLink && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">🔗 קישור הזמנה ציבורי</h2>
              <p className="text-emerald-50 mb-4">
                שתף את הקישור הזה עם הלקוחות שלך כדי שיוכלו להזמין תמרים ישירות ללא התחברות
              </p>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={publicOrderLink}
                    readOnly
                    className="flex-1 bg-white/20 text-white placeholder-white/70 px-4 py-2 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 font-mono text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => copyToClipboard(publicOrderLink)}
                    className="px-6 py-2 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 font-semibold transition whitespace-nowrap flex items-center gap-2"
                  >
                    📋 העתק קישור
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`🌴 הזמנת תמרים טריים!\n\nלהזמנה ישירה:\n${publicOrderLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition flex items-center gap-2"
                >
                  📱 שתף בווטסאפ
                </a>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: 'הזמנת תמרים',
                        text: '🌴 הזמנת תמרים טריים!',
                        url: publicOrderLink,
                      })
                    } else {
                      copyToClipboard(publicOrderLink)
                    }
                  }}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition flex items-center gap-2"
                >
                  🔗 שתף
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-sm text-emerald-50">
              💡 <strong>טיפ:</strong> הקישור הזה תמיד זמין וניתן לשתף אותו בכל עת. כל הזמנה דרך הקישור תירשם תחת השם שלך במערכת.
            </p>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Inventory */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">מלאי כולל</h3>
          <p className="text-4xl font-bold">{totalInventory.toLocaleString()}</p>
          <p className="text-sm opacity-90 mt-1">ק&quot;ג</p>
        </div>

        {/* Warehouses */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">מחסנים פעילים</h3>
          <p className="text-4xl font-bold">{warehouses?.length || 0}</p>
          <p className="text-sm opacity-90 mt-1">מחסנים</p>
        </div>

        {/* Products */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">מוצרים</h3>
          <p className="text-4xl font-bold">{products?.length || 0}</p>
          <p className="text-sm opacity-90 mt-1">סוגי תמרים</p>
        </div>
      </div>

      {/* Warehouses List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">מחסנים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses?.map((warehouse) => (
            <div
              key={warehouse.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{warehouse.name}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    warehouse.warehouse_type === 'freezing'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {warehouse.warehouse_type === 'freezing' ? 'הקפאה' : 'קירור'}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-1">מיקום: {warehouse.location}</p>
              <p className="text-gray-600 text-sm">
                קיבולת: {warehouse.capacity_kg?.toLocaleString()} ק&quot;ג
              </p>
              {warehouse.spoilage_alert_days && (
                <p className="text-amber-600 text-sm mt-2">
                  ⚠️ התראת קלקול: {warehouse.spoilage_alert_days} ימים
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">מוצרים</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מוצר
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  זן
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מחיר לק&quot;ג
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products?.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {product.variety}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₪{product.price_per_kg}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
