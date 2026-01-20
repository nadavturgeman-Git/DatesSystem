'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Profile {
  id: string;
  role: 'admin' | 'team_leader' | 'distributor';
  full_name: string;
  phone: string | null;
  email: string;
  team_leader_id: string | null;
  created_at: string;
  team_leader?: { full_name: string } | null;
}

interface DistributorProfile {
  id: string;
  user_id: string;
  preferred_payment_method: string;
  commission_rate: number;
  prefers_commission_in_goods: boolean;
  account_balance: number;
}

interface DistributorWithDetails extends Profile {
  distributor_profile?: DistributorProfile | null;
  orders_count?: number;
  total_sales?: number;
}

export default function AdminDistributorsPage() {
  const supabase = createClient();
  
  const [distributors, setDistributors] = useState<DistributorWithDetails[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter
  const [filterRole, setFilterRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<DistributorWithDetails | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'distributor' as 'admin' | 'team_leader' | 'distributor',
    team_leader_id: '',
    commission_rate: '15',
    prefers_commission_in_goods: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Use API route that bypasses RLS using service role
      const response = await fetch('/api/admin/distributors/list')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת מפיצים')
      }

      const profilesData = data.distributors || []
      console.log('Loaded distributors:', profilesData.length, profilesData)

      // Data is already combined from API
      const usersWithDetails: DistributorWithDetails[] = profilesData
      
      setDistributors(usersWithDetails);
      setTeamLeaders(usersWithDetails.filter((u) => u.role === 'team_leader'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(user: DistributorWithDetails) {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      team_leader_id: user.team_leader_id || '',
      commission_rate: user.distributor_profile?.commission_rate?.toString() || '15',
      prefers_commission_in_goods: user.distributor_profile?.prefers_commission_in_goods || false,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    
    setSaving(true);
    setError('');

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: formData.role,
          team_leader_id: formData.team_leader_id || null,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update or create distributor profile
      if (formData.role === 'distributor') {
        const distProfileData = {
          user_id: editingUser.id,
          commission_rate: parseFloat(formData.commission_rate),
          prefers_commission_in_goods: formData.prefers_commission_in_goods,
        };

        if (editingUser.distributor_profile) {
          const { error } = await supabase
            .from('distributor_profiles')
            .update(distProfileData)
            .eq('user_id', editingUser.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('distributor_profiles')
            .insert({ ...distProfileData, preferred_payment_method: 'cash' });
          if (error) throw error;
        }
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter users
  const filteredUsers = distributors.filter((user) => {
    if (filterRole && user.role !== filterRole) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !user.full_name.toLowerCase().includes(query) &&
        !user.email.toLowerCase().includes(query) &&
        !(user.phone || '').includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const roleLabels: Record<string, string> = {
    admin: 'מנהל',
    team_leader: 'ראש צוות',
    distributor: 'מפיץ',
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    team_leader: 'bg-blue-100 text-blue-800',
    distributor: 'bg-green-100 text-green-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען משתמשים...</p>
        </div>
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-900">👥 ניהול מפיצים</h1>
          <p className="text-gray-600 mt-1">מפיצים, ראשי צוותים, הרשאות ועמלות</p>
        </div>
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
            {distributors.filter((u) => u.role === 'admin').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">ראשי צוותים</h3>
          <p className="text-3xl font-bold">
            {distributors.filter((u) => u.role === 'team_leader').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מפיצים</h3>
          <p className="text-3xl font-bold">
            {distributors.filter((u) => u.role === 'distributor').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ הזמנות</h3>
          <p className="text-3xl font-bold">
            {distributors.reduce((sum, u) => sum + (u.orders_count || 0), 0)}
          </p>
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
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">שם מלא</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">אימייל</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">טלפון</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">תפקיד</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">ראש צוות</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">הזמנות</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">עמלה</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  <div className="text-4xl mb-4">👥</div>
                  <p className="text-lg font-medium">לא נמצאו משתמשים</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{user.email}</td>
                  <td className="px-6 py-4 text-gray-600">{user.phone || '-'}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        roleColors[user.role]
                      }`}
                    >
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {user.team_leader?.full_name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{user.orders_count || 0}</p>
                      <p className="text-xs text-gray-500">
                        ₪{(user.total_sales || 0).toLocaleString()}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'distributor' ? (
                      <div>
                        <p className="font-medium text-emerald-600">
                          {user.distributor_profile?.commission_rate || 15}%
                        </p>
                        {user.distributor_profile?.prefers_commission_in_goods && (
                          <p className="text-xs text-gray-500">בסחורה</p>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-emerald-600 hover:text-emerald-800 font-medium transition"
                    >
                      ערוך
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">עריכת משתמש</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם מלא *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  אימייל
                </label>
                <input
                  type="email"
                  disabled
                  value={formData.email}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-100 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">לא ניתן לשנות אימייל</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  טלפון
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="050-0000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תפקיד *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'admin' | 'team_leader' | 'distributor',
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="distributor">מפיץ</option>
                  <option value="team_leader">ראש צוות</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>
              {formData.role === 'distributor' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ראש צוות
                    </label>
                    <select
                      value={formData.team_leader_id}
                      onChange={(e) =>
                        setFormData({ ...formData, team_leader_id: e.target.value })
                      }
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      אחוז עמלה
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formData.commission_rate}
                      onChange={(e) =>
                        setFormData({ ...formData, commission_rate: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="prefers_commission_in_goods"
                      checked={formData.prefers_commission_in_goods}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          prefers_commission_in_goods: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <label htmlFor="prefers_commission_in_goods" className="text-sm text-gray-700">
                      העדפה לקבל עמלה בסחורה
                    </label>
                  </div>
                </>
              )}

              {/* Account Balance */}
              {editingUser.distributor_profile && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">יתרת חשבון</h3>
                  <p className="text-2xl font-bold text-emerald-600">
                    ₪{editingUser.distributor_profile.account_balance.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">זיכויים מהחזרות ונזקים</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold transition"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
