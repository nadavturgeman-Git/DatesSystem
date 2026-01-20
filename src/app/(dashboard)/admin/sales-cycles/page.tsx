'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface SalesCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  minimum_order_kg: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminSalesCyclesPage() {
  const supabase = createClient();
  
  const [cycles, setCycles] = useState<SalesCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState<SalesCycle | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_active: false,
    minimum_order_kg: '50',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const { data, error: cyclesError } = await supabase
        .from('sales_cycles')
        .select('*')
        .order('start_date', { ascending: false });

      if (cyclesError) throw cyclesError;
      setCycles(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingCycle(null);
    setFormData({
      name: '',
      start_date: '',
      end_date: '',
      is_active: false,
      minimum_order_kg: '50',
      notes: '',
    });
    setShowModal(true);
  }

  function openEditModal(cycle: SalesCycle) {
    setEditingCycle(cycle);
    setFormData({
      name: cycle.name,
      start_date: cycle.start_date,
      end_date: cycle.end_date,
      is_active: cycle.is_active,
      minimum_order_kg: cycle.minimum_order_kg.toString(),
      notes: cycle.notes || '',
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingCycle) {
        const { error: updateError } = await supabase
          .from('sales_cycles')
          .update({
            name: formData.name,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_active: formData.is_active,
            minimum_order_kg: parseFloat(formData.minimum_order_kg),
            notes: formData.notes || null,
          })
          .eq('id', editingCycle.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('sales_cycles')
          .insert({
            name: formData.name,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_active: formData.is_active,
            minimum_order_kg: parseFloat(formData.minimum_order_kg),
            notes: formData.notes || null,
          });

        if (insertError) throw insertError;
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(cycleId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('sales_cycles')
        .update({ is_active: !currentStatus })
        .eq('id', cycleId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const activeCycle = cycles.find(c => c.is_active);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
          >
            ← חזרה ללוח בקרה
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">🔄 מחזורי מכירה</h1>
          <p className="text-gray-600 mt-2">ניהול חלונות הזמנה ומחזורי מכירה</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          + צור מחזור חדש
        </button>
      </div>

      {/* Active Cycle Alert */}
      {activeCycle && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <strong>מחזור פעיל:</strong> {activeCycle.name} ({new Date(activeCycle.start_date).toLocaleDateString('he-IL')} - {new Date(activeCycle.end_date).toLocaleDateString('he-IL')})
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Cycles List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">טוען מחזורי מכירה...</p>
        </div>
      ) : cycles.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">אין מחזורי מכירה</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cycles.map((cycle) => (
            <div
              key={cycle.id}
              className={`bg-white rounded-lg shadow p-6 border-r-4 ${
                cycle.is_active ? 'border-green-500' : 'border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{cycle.name}</h3>
                  {cycle.is_active && (
                    <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full mb-2 inline-block">
                      פעיל
                    </span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div>
                  <strong>תאריך התחלה:</strong> {new Date(cycle.start_date).toLocaleDateString('he-IL')}
                </div>
                <div>
                  <strong>תאריך סיום:</strong> {new Date(cycle.end_date).toLocaleDateString('he-IL')}
                </div>
                <div>
                  <strong>מינימום הזמנה:</strong> {cycle.minimum_order_kg} ק&quot;ג
                </div>
                {cycle.notes && (
                  <div>
                    <strong>הערות:</strong> {cycle.notes}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(cycle)}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  ערוך
                </button>
                <button
                  onClick={() => toggleActive(cycle.id, cycle.is_active)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                    cycle.is_active
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-green-500 hover:bg-green-600 text-white'
                  }`}
                >
                  {cycle.is_active ? 'השבת' : 'הפעל'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {editingCycle ? 'ערוך מחזור מכירה' : 'צור מחזור מכירה חדש'}
              </h2>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    שם מחזור *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      תאריך התחלה *
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      תאריך סיום *
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      מינימום הזמנה (ק&quot;ג)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.minimum_order_kg}
                      onChange={(e) => setFormData({ ...formData, minimum_order_kg: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center pt-8">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">מחזור פעיל</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    הערות
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-4 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    {saving ? 'שומר...' : 'שמור'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
