'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Customer {
  id: string;
  hub_coordinator_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  hub_coordinator?: { full_name: string } | null;
}

export default function AdminCustomersPage() {
  const supabase = createClient();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [coordinators, setCoordinators] = useState<{ id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCoordinator, setFilterCoordinator] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    hub_coordinator_id: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Get customers with coordinator info
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*, hub_coordinator:profiles!customers_hub_coordinator_id_fkey(full_name)')
        .order('full_name');

      if (customersError) throw customersError;

      // Get coordinators (distributors and team leaders)
      const { data: coordinatorsData, error: coordinatorsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['distributor', 'team_leader'])
        .order('full_name');

      if (coordinatorsError) throw coordinatorsError;

      setCustomers(customersData || []);
      setCoordinators(coordinatorsData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingCustomer(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      hub_coordinator_id: '',
      is_active: true,
    });
    setShowModal(true);
  }

  function openEditModal(customer: Customer) {
    setEditingCustomer(customer);
    setFormData({
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
      hub_coordinator_id: customer.hub_coordinator_id,
      is_active: customer.is_active,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const customerData = {
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address || null,
        notes: formData.notes || null,
        hub_coordinator_id: formData.hub_coordinator_id,
        is_active: formData.is_active,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(customerData)
          .eq('id', editingCustomer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customers').insert(customerData);
        if (error) throw error;
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(customer: Customer) {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !customer.is_active })
        .eq('id', customer.id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Filter customers
  const filteredCustomers = customers.filter((customer) => {
    if (!showInactive && !customer.is_active) return false;
    if (filterCoordinator && customer.hub_coordinator_id !== filterCoordinator) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !customer.full_name.toLowerCase().includes(query) &&
        !customer.phone.includes(query) &&
        !(customer.email || '').toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  // Group by coordinator
  const customersByCoordinator = filteredCustomers.reduce((acc, customer) => {
    const coordName = customer.hub_coordinator?.full_name || 'ללא רכז';
    if (!acc[coordName]) {
      acc[coordName] = [];
    }
    acc[coordName].push(customer);
    return acc;
  }, {} as Record<string, Customer[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען לקוחות...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">👤 ניהול לקוחות</h1>
          <p className="text-gray-600 mt-1">לקוחות קצה, CRM והזמנות עצמיות</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
        >
          <span>+</span>
          הוסף לקוח חדש
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ לקוחות</h3>
          <p className="text-3xl font-bold">{customers.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">לקוחות פעילים</h3>
          <p className="text-3xl font-bold">{customers.filter((c) => c.is_active).length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">רכזים</h3>
          <p className="text-3xl font-bold">{coordinators.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="חיפוש לפי שם, טלפון או אימייל..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <select
            value={filterCoordinator}
            onChange={(e) => setFilterCoordinator(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">כל הרכזים</option>
            {coordinators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-gray-700">הצג לא פעילים</span>
          </label>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">שם הלקוח</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">טלפון</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">אימייל</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">כתובת</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">רכז</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">סטטוס</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="text-4xl mb-4">👤</div>
                  <p className="text-lg font-medium">לא נמצאו לקוחות</p>
                  <p className="text-sm">לחץ על &quot;הוסף לקוח חדש&quot; להתחיל</p>
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className={`hover:bg-gray-50 ${!customer.is_active ? 'opacity-50' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-gray-900">{customer.full_name}</p>
                      {customer.notes && (
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">
                          {customer.notes}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{customer.phone}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm">{customer.email || '-'}</td>
                  <td className="px-6 py-4 text-gray-600 text-sm max-w-[200px] truncate">
                    {customer.address || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {customer.hub_coordinator?.full_name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(customer)}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition ${
                        customer.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                    >
                      {customer.is_active ? 'פעיל' : 'לא פעיל'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEditModal(customer)}
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

      {/* Summary by Coordinator */}
      {Object.keys(customersByCoordinator).length > 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">סיכום לפי רכז</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(customersByCoordinator).map(([coordName, custList]) => (
              <div
                key={coordName}
                className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition"
              >
                <h3 className="font-semibold text-gray-900">{coordName}</h3>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{custList.length}</p>
                <p className="text-xs text-gray-500">לקוחות</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingCustomer ? 'עריכת לקוח' : 'הוספת לקוח חדש'}
            </h2>
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
                  placeholder="שם הלקוח"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  טלפון *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="050-0000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  אימייל
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  כתובת
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="כתובת מלאה"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  רכז/מפיץ אחראי *
                </label>
                <select
                  required
                  value={formData.hub_coordinator_id}
                  onChange={(e) =>
                    setFormData({ ...formData, hub_coordinator_id: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">בחר רכז</option>
                  {coordinators.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  הערות
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  rows={3}
                  placeholder="הערות פנימיות על הלקוח"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  לקוח פעיל
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {saving ? 'שומר...' : editingCustomer ? 'שמור שינויים' : 'הוסף לקוח'}
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
