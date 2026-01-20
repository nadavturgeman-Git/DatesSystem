'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Warehouse {
  id: string;
  name: string;
  warehouse_type: 'freezing' | 'cooling';
  location: string | null;
  capacity_kg: number | null;
  spoilage_alert_days: number | null;
  is_active: boolean;
  created_at: string;
}

interface WarehouseWithStock extends Warehouse {
  currentStock: number;
}

export default function AdminWarehousesPage() {
  const supabase = createClient();
  
  const [warehouses, setWarehouses] = useState<WarehouseWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    warehouse_type: 'freezing' as 'freezing' | 'cooling',
    location: '',
    capacity_kg: '',
    spoilage_alert_days: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadWarehouses();
  }, []);

  async function loadWarehouses() {
    setLoading(true);
    try {
      // Get warehouses
      const { data: warehousesData, error: warehousesError } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (warehousesError) throw warehousesError;

      // Get stock per warehouse
      const { data: palletsData, error: palletsError } = await supabase
        .from('pallets')
        .select('warehouse_id, current_weight_kg')
        .eq('is_depleted', false);

      if (palletsError) throw palletsError;

      // Calculate stock per warehouse
      const stockByWarehouse: Record<string, number> = {};
      palletsData?.forEach((pallet) => {
        stockByWarehouse[pallet.warehouse_id] =
          (stockByWarehouse[pallet.warehouse_id] || 0) + pallet.current_weight_kg;
      });

      const warehousesWithStock: WarehouseWithStock[] = (warehousesData || []).map((w) => ({
        ...w,
        currentStock: stockByWarehouse[w.id] || 0,
      }));

      setWarehouses(warehousesWithStock);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingWarehouse(null);
    setFormData({
      name: '',
      warehouse_type: 'freezing',
      location: '',
      capacity_kg: '',
      spoilage_alert_days: '',
      is_active: true,
    });
    setShowModal(true);
  }

  function openEditModal(warehouse: Warehouse) {
    setEditingWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      warehouse_type: warehouse.warehouse_type,
      location: warehouse.location || '',
      capacity_kg: warehouse.capacity_kg?.toString() || '',
      spoilage_alert_days: warehouse.spoilage_alert_days?.toString() || '',
      is_active: warehouse.is_active,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const warehouseData = {
        name: formData.name,
        warehouse_type: formData.warehouse_type,
        location: formData.location || null,
        capacity_kg: formData.capacity_kg ? parseFloat(formData.capacity_kg) : null,
        spoilage_alert_days: formData.spoilage_alert_days
          ? parseInt(formData.spoilage_alert_days)
          : null,
        is_active: formData.is_active,
      };

      if (editingWarehouse) {
        const { error } = await supabase
          .from('warehouses')
          .update(warehouseData)
          .eq('id', editingWarehouse.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('warehouses').insert(warehouseData);
        if (error) throw error;
      }

      setShowModal(false);
      loadWarehouses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(warehouse: Warehouse) {
    try {
      const { error } = await supabase
        .from('warehouses')
        .update({ is_active: !warehouse.is_active })
        .eq('id', warehouse.id);
      if (error) throw error;
      loadWarehouses();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const totalCapacity = warehouses.reduce((sum, w) => sum + (w.capacity_kg || 0), 0);
  const totalStock = warehouses.reduce((sum, w) => sum + w.currentStock, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען מחסנים...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">🏭 ניהול מחסנים</h1>
          <p className="text-gray-600 mt-1">מחסני הקפאה וקירור, קיבולת ואזהרות</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
        >
          <span>+</span>
          הוסף מחסן חדש
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">סה&quot;כ מחסנים</h3>
          <p className="text-3xl font-bold">{warehouses.length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">❄️ מחסני הקפאה</h3>
          <p className="text-3xl font-bold">
            {warehouses.filter((w) => w.warehouse_type === 'freezing').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">🌡️ מחסני קירור</h3>
          <p className="text-3xl font-bold">
            {warehouses.filter((w) => w.warehouse_type === 'cooling').length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">ניצולת קיבולת</h3>
          <p className="text-3xl font-bold">
            {totalCapacity > 0 ? Math.round((totalStock / totalCapacity) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {warehouses.length === 0 ? (
          <div className="col-span-2 bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">🏭</div>
            <p className="text-lg font-medium text-gray-900">אין מחסנים במערכת</p>
            <p className="text-gray-500">לחץ על "הוסף מחסן חדש" להתחיל</p>
          </div>
        ) : (
          warehouses.map((warehouse) => (
            <div
              key={warehouse.id}
              className={`bg-white rounded-lg shadow-md border-2 transition ${
                warehouse.is_active ? 'border-transparent hover:border-emerald-300' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                        warehouse.warehouse_type === 'freezing'
                          ? 'bg-blue-100'
                          : 'bg-orange-100'
                      }`}
                    >
                      {warehouse.warehouse_type === 'freezing' ? '❄️' : '🌡️'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{warehouse.name}</h3>
                      <p className="text-sm text-gray-500">
                        {warehouse.warehouse_type === 'freezing' ? 'מחסן הקפאה' : 'מחסן קירור'}
                        {warehouse.location && ` • ${warehouse.location}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive(warehouse)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      warehouse.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {warehouse.is_active ? 'פעיל' : 'לא פעיל'}
                  </button>
                </div>

                {/* Stock Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">מלאי נוכחי</span>
                    <span className="font-semibold text-gray-900">
                      {warehouse.currentStock.toLocaleString()} ק&quot;ג
                      {warehouse.capacity_kg && (
                        <span className="text-gray-500 font-normal">
                          {' '}
                          / {warehouse.capacity_kg.toLocaleString()} ק&quot;ג
                        </span>
                      )}
                    </span>
                  </div>
                  {warehouse.capacity_kg && (
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          warehouse.currentStock / warehouse.capacity_kg > 0.9
                            ? 'bg-red-500'
                            : warehouse.currentStock / warehouse.capacity_kg > 0.7
                            ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            (warehouse.currentStock / warehouse.capacity_kg) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Spoilage Alert (for cooling only) */}
                {warehouse.warehouse_type === 'cooling' && warehouse.spoilage_alert_days && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-orange-800">
                      ⚠️ התראת קלקול: {warehouse.spoilage_alert_days} ימים
                    </p>
                  </div>
                )}

                <button
                  onClick={() => openEditModal(warehouse)}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium transition"
                >
                  ערוך מחסן
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingWarehouse ? 'עריכת מחסן' : 'הוספת מחסן חדש'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם המחסן *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="לדוגמה: מחסן בקעא"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סוג מחסן *
                </label>
                <select
                  required
                  value={formData.warehouse_type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      warehouse_type: e.target.value as 'freezing' | 'cooling',
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="freezing">❄️ הקפאה</option>
                  <option value="cooling">🌡️ קירור</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מיקום
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="לדוגמה: ירושלים"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  קיבולת (ק&quot;ג)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.capacity_kg}
                  onChange={(e) => setFormData({ ...formData, capacity_kg: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="50000"
                />
              </div>
              {formData.warehouse_type === 'cooling' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    התראת קלקול (ימים)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.spoilage_alert_days}
                    onChange={(e) =>
                      setFormData({ ...formData, spoilage_alert_days: e.target.value })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="7"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    מספר ימים עד לשליחת התראה על סכנת קלקול
                  </p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  מחסן פעיל
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {saving ? 'שומר...' : editingWarehouse ? 'שמור שינויים' : 'הוסף מחסן'}
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
