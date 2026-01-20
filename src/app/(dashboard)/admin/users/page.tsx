'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Profile {
  id: string
  full_name: string
  email: string
  phone?: string
  role: 'admin' | 'team_leader' | 'distributor'
  team_leader_id?: string
  created_at: string
  team_leader?: { full_name: string } | null
  distributor_profile?: {
    employment_model?: string
    paybox_link?: string
  } | null
}

interface OrderStats {
  count: number
  total: number
}

export default function AdminUsersPage() {
  const supabase = createClient()
  
  const [users, setUsers] = useState<Profile[]>([])
  const [teamLeaders, setTeamLeaders] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Filters
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterTeamLeader, setFilterTeamLeader] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '', // Only needed for new users
    role: 'distributor' as 'admin' | 'team_leader' | 'distributor',
    team_leader_id: '',
    employment_model: 'Credit_Commission' as 'Credit_Commission' | 'Cash_Paybox' | 'Goods_Commission',
    paybox_link: '',
    pickup_location: '',
    city: '',
  })
  const [saving, setSaving] = useState(false)
  const [orderStats, setOrderStats] = useState<Record<string, OrderStats>>({})

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      // Use API route that bypasses RLS using service role
      const response = await fetch('/api/admin/users/list')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת משתמשים')
      }

      const usersWithDetails: Profile[] = data.users || []
      console.log('Loaded profiles:', usersWithDetails.length, usersWithDetails)

      // Get orders count per user
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('distributor_id, total_amount')

      if (ordersError) throw ordersError

      // Aggregate orders
      const ordersByUser: Record<string, OrderStats> = {}
      ordersData?.forEach((order) => {
        if (!ordersByUser[order.distributor_id]) {
          ordersByUser[order.distributor_id] = { count: 0, total: 0 }
        }
        ordersByUser[order.distributor_id].count++
        ordersByUser[order.distributor_id].total += order.total_amount || 0
      })
      setOrderStats(ordersByUser)

      setUsers(usersWithDetails)
      setTeamLeaders(usersWithDetails.filter((u) => u.role === 'team_leader'))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openAddModal() {
    setEditingUser(null)
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '', // Will be auto-generated
      role: 'distributor',
      team_leader_id: '',
      employment_model: 'Credit_Commission',
      paybox_link: '',
      pickup_location: '',
      city: '',
    })
    setShowModal(true)
  }

  function openEditModal(user: Profile) {
    setEditingUser(user)
    setFormData({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      password: '', // Not needed for edit, but required by type
      role: user.role,
      team_leader_id: user.team_leader_id || '',
      employment_model: (user.distributor_profile?.employment_model as any) || 'Credit_Commission',
      paybox_link: user.distributor_profile?.paybox_link || '',
      pickup_location: (user as any).pickup_location || '',
      city: (user as any).city || '',
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.full_name || !formData.email || !formData.role) {
      setError('יש למלא את כל השדות החובה: שם מלא, אימייל ותפקיד')
      return
    }
    
    setSaving(true)
    setError('')

    try {
      // If creating new user
      if (!editingUser) {
        // Generate a temporary password (user should change it)
        const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`
        
        const requestBody = {
          email: formData.email.trim(),
          password: tempPassword,
          full_name: formData.full_name.trim(),
          phone: formData.phone?.trim() || null,
          role: formData.role,
          team_leader_id: formData.team_leader_id || null,
          employment_model: formData.role === 'distributor' ? formData.employment_model : null,
          paybox_link: formData.role === 'distributor' && formData.employment_model === 'Cash_Paybox' ? formData.paybox_link?.trim() || null : null,
          pickup_location: formData.role === 'distributor' ? formData.pickup_location?.trim() || null : null,
          city: formData.role === 'distributor' ? formData.city?.trim() || null : null,
        }
        
        console.log('Creating user with data:', { ...requestBody, password: '***' })
        
        const response = await fetch('/api/admin/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'שגיאה ביצירת משתמש')
        }

        console.log('User created successfully:', data)
        setShowModal(false)
        alert(`משתמש נוצר בהצלחה!\nאימייל: ${formData.email}\nסיסמה זמנית: ${tempPassword}\n\nהמשתמש צריך לשנות את הסיסמה בהתחברות הראשונה.`)
        
        // Wait a bit for the database to sync, then reload
        setTimeout(() => {
          loadData()
        }, 500)
        return
      }

      // If editing existing user
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: formData.role,
          team_leader_id: formData.team_leader_id || null,
          pickup_location: formData.pickup_location || null,
          city: formData.city || null,
        })
        .eq('id', editingUser.id)

      if (profileError) throw profileError

      // Update or create distributor profile
      if (formData.role === 'distributor') {
        const distProfileData: any = {
          user_id: editingUser.id,
          employment_model: formData.employment_model,
        }
        if (formData.paybox_link) {
          distProfileData.paybox_link = formData.paybox_link
        }

        const { data: existing } = await supabase
          .from('distributor_profiles')
          .select('id')
          .eq('user_id', editingUser.id)
          .single()

        if (existing) {
          const { error } = await supabase
            .from('distributor_profiles')
            .update(distProfileData)
            .eq('user_id', editingUser.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('distributor_profiles')
            .insert({ ...distProfileData, preferred_payment_method: 'cash' })
          if (error) throw error
        }
      }

      setShowModal(false)
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Filter users
  const filteredUsers = users.filter((user) => {
    if (filterRole && user.role !== filterRole) return false
    if (filterTeamLeader) {
      if (filterTeamLeader === 'unassigned' && user.team_leader_id) return false
      if (filterTeamLeader !== 'unassigned' && user.team_leader_id !== filterTeamLeader) return false
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (
        !user.full_name.toLowerCase().includes(query) &&
        !user.email.toLowerCase().includes(query) &&
        !(user.phone || '').includes(query)
      ) {
        return false
      }
    }
    return true
  })

  const roleLabels: Record<string, string> = {
    admin: 'מנהל',
    team_leader: 'ראש צוות',
    distributor: 'מפיץ',
  }

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    team_leader: 'bg-blue-100 text-blue-800',
    distributor: 'bg-green-100 text-green-800',
  }

  const employmentModelLabels: Record<string, string> = {
    Credit_Commission: 'אשראי + עמלה',
    Cash_Paybox: 'מזומן + Paybox',
    Goods_Commission: 'עמלה במוצרים',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען משתמשים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin" className="text-gray-500 hover:text-gray-700">
              ← חזרה ללוח בקרה
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">👥 ניהול משתמשים</h1>
          <p className="text-gray-600 mt-1">ניהול מלא של כל המשתמשים במערכת: מנהלים, ראשי צוותים, מפיצים ולקוחות</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          + משתמש חדש
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מנהלים</h3>
          <p className="text-3xl font-bold">
            {users.filter((u) => u.role === 'admin').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">ראשי צוותים</h3>
          <p className="text-3xl font-bold">
            {users.filter((u) => u.role === 'team_leader').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מפיצים</h3>
          <p className="text-3xl font-bold">
            {users.filter((u) => u.role === 'distributor').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ משתמשים</h3>
          <p className="text-3xl font-bold">{users.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="חיפוש לפי שם, אימייל או טלפון..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">כל התפקידים</option>
            <option value="admin">מנהלים</option>
            <option value="team_leader">ראשי צוותים</option>
            <option value="distributor">מפיצים</option>
          </select>
          <select
            value={filterTeamLeader}
            onChange={(e) => setFilterTeamLeader(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">כל האזורים</option>
            <option value="unassigned">ללא ראש צוות</option>
            {teamLeaders.map((tl) => (
              <option key={tl.id} value={tl.id}>
                {tl.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תפקיד</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">אימייל</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">טלפון</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ראש צוות</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מודל תעסוקה</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">הזמנות</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.full_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.team_leader?.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.distributor_profile?.employment_model
                      ? employmentModelLabels[user.distributor_profile.employment_model] || '-'
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {orderStats[user.id] ? (
                      <div>
                        <div className="font-semibold">{orderStats[user.id].count} הזמנות</div>
                        <div className="text-xs text-gray-500">₪{orderStats[user.id].total.toFixed(2)}</div>
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      ערוך
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingUser ? 'ערוך משתמש' : 'משתמש חדש'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!editingUser}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-gray-100"
                  />
                  {editingUser && (
                    <p className="text-xs text-gray-500 mt-1">לא ניתן לשנות אימייל</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                {formData.role === 'distributor' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        נקודת איסוף (כתובת/מיקום) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.pickup_location}
                        onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                        placeholder="למשל: רחוב הרצל 10, ירושלים"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">כתובת או מיקום שבו הלקוחות אוספים את ההזמנות</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">עיר</label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        placeholder="למשל: ירושלים"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="admin">מנהל</option>
                    <option value="team_leader">ראש צוות</option>
                    <option value="distributor">מפיץ</option>
                  </select>
                </div>
                {formData.role === 'distributor' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ראש צוות</label>
                      <select
                        value={formData.team_leader_id}
                        onChange={(e) => setFormData({ ...formData, team_leader_id: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">ללא ראש צוות</option>
                        {teamLeaders.map((tl) => (
                          <option key={tl.id} value={tl.id}>
                            {tl.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">מודל תעסוקה</label>
                      <select
                        value={formData.employment_model}
                        onChange={(e) => setFormData({ ...formData, employment_model: e.target.value as any })}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="Credit_Commission">אשראי + עמלה</option>
                        <option value="Cash_Paybox">מזומן + Paybox</option>
                        <option value="Goods_Commission">עמלה במוצרים</option>
                      </select>
                    </div>
                    {formData.employment_model === 'Cash_Paybox' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">קישור Paybox</label>
                        <input
                          type="url"
                          value={formData.paybox_link}
                          onChange={(e) => setFormData({ ...formData, paybox_link: e.target.value })}
                          placeholder="https://paybox.co.il/..."
                          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        />
                      </div>
                    )}
                  </>
                )}
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition disabled:opacity-50"
                  >
                    {saving ? 'שומר...' : 'שמור'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-6 py-3 rounded-lg transition"
                  >
                    ביטול
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
