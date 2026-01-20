'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Pallet {
  id: string;
  pallet_id: string;
  warehouse_id: string;
  product_id: string;
  entry_date: string;
  initial_weight_kg: number;
  current_weight_kg: number;
  batch_number: string | null;
  expiry_date: string | null;
  is_depleted: boolean;
  warehouse?: { name: string; warehouse_type: string };
  product?: { name: string; variety: string };
}

interface Product {
  id: string;
  name: string;
  variety: string;
  price_per_kg: number;
  is_active: boolean;
}

interface Warehouse {
  id: string;
  name: string;
  warehouse_type: string;
  location: string;
  capacity_kg: number;
  is_active: boolean;
}

export default function AdminInventoryPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [showDepleted, setShowDepleted] = useState(false);
  
  // Add pallet modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPallet, setNewPallet] = useState({
    pallet_id: '',
    warehouse_id: '',
    product_id: '',
    initial_weight_kg: '',
    batch_number: '',
    expiry_date: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      // First, check current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('Current user:', currentUser?.email, currentUser?.id);
      
      // Get user profile to check role
      const { data: currentProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser?.id)
        .single();
      
      console.log('Current profile:', currentProfile);
      if (profileErr) {
        console.error('Profile error:', profileErr);
        console.error('Profile error details:', {
          message: profileErr.message,
          code: profileErr.code,
          details: profileErr.details,
          hint: profileErr.hint,
        });
      }
      if (currentProfile?.role !== 'admin') {
        setError(`⚠️ המשתמש המחובר אינו מנהל. תפקיד: ${currentProfile?.role || 'לא נמצא'}. יש להתחבר עם admin@dates.com`);
        setLoading(false);
        return;
      }

      const [palletsRes, productsRes, warehousesRes] = await Promise.all([
        supabase
          .from('pallets')
          .select('*, warehouse:warehouses(name, warehouse_type), product:products(name, variety)')
          .order('entry_date', { ascending: false }),
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('warehouses').select('*').eq('is_active', true),
      ]);

      if (palletsRes.error) {
        console.error('Pallets error:', palletsRes.error);
        const errorMsg = palletsRes.error.message || JSON.stringify(palletsRes.error);
        setError(`שגיאה בטעינת פלטות: ${errorMsg}`);
        throw palletsRes.error;
      }
      if (productsRes.error) {
        console.error('Products error:', productsRes.error);
        const errorMsg = productsRes.error.message || JSON.stringify(productsRes.error);
        setError(`שגיאה בטעינת מוצרים: ${errorMsg}`);
        throw productsRes.error;
      }
      if (warehousesRes.error) {
        console.error('Warehouses error:', warehousesRes.error);
        const errorMsg = warehousesRes.error.message || JSON.stringify(warehousesRes.error);
        setError(`שגיאה בטעינת מחסנים: ${errorMsg}`);
        throw warehousesRes.error;
      }

      setPallets(palletsRes.data || []);
      setProducts(productsRes.data || []);
      setWarehouses(warehousesRes.data || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      const errorMessage = err?.message || err?.error?.message || JSON.stringify(err);
      setError(`שגיאה בטעינת הנתונים: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPallet(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { error } = await supabase.from('pallets').insert({
        pallet_id: newPallet.pallet_id,
        warehouse_id: newPallet.warehouse_id,
        product_id: newPallet.product_id,
        initial_weight_kg: parseFloat(newPallet.initial_weight_kg),
        current_weight_kg: parseFloat(newPallet.initial_weight_kg),
        batch_number: newPallet.batch_number || null,
        expiry_date: newPallet.expiry_date || null,
      });

      if (error) throw error;

      setShowAddModal(false);
      setNewPallet({
        pallet_id: '',
        warehouse_id: '',
        product_id: '',
        initial_weight_kg: '',
        batch_number: '',
        expiry_date: '',
      });
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Filter pallets
  const filteredPallets = pallets.filter((p) => {
    if (!showDepleted && p.is_depleted) return false;
    if (filterWarehouse && p.warehouse_id !== filterWarehouse) return false;
    if (filterProduct && p.product_id !== filterProduct) return false;
    return true;
  });

  // Calculate stats
  const totalStock = filteredPallets
    .filter((p) => !p.is_depleted)
    .reduce((sum, p) => sum + p.current_weight_kg, 0);
  
  const stockByProduct = products.map((product) => ({
    ...product,
    stock: pallets
      .filter((p) => p.product_id === product.id && !p.is_depleted)
      .reduce((sum, p) => sum + p.current_weight_kg, 0),
  }));

  const stockByWarehouse = warehouses.map((warehouse) => ({
    ...warehouse,
    stock: pallets
      .filter((p) => p.warehouse_id === warehouse.id && !p.is_depleted)
      .reduce((sum, p) => sum + p.current_weight_kg, 0),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נתוני מלאי...</p>
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
          <h1 className="text-3xl font-bold text-gray-900">📦 ניהול מלאי</h1>
          <p className="text-gray-600 mt-1">צפייה וניהול פלטות, מלאי ומחסנים</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
        >
          <span>+</span>
          הוסף פלטה חדשה
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מלאי כולל</h3>
          <p className="text-3xl font-bold">{totalStock.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-1">ק&quot;ג</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">פלטות פעילות</h3>
          <p className="text-3xl font-bold">{pallets.filter((p) => !p.is_depleted).length}</p>
          <p className="text-xs opacity-75 mt-1">פלטות</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מוצרים</h3>
          <p className="text-3xl font-bold">{products.length}</p>
          <p className="text-xs opacity-75 mt-1">סוגי תמרים</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מחסנים</h3>
          <p className="text-3xl font-bold">{warehouses.length}</p>
          <p className="text-xs opacity-75 mt-1">מחסנים פעילים</p>
        </div>
      </div>

      {/* Stock Summary by Product */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">מלאי לפי מוצר</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stockByProduct.map((product) => (
            <div
              key={product.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition"
            >
              <h3 className="font-semibold text-gray-900">{product.name}</h3>
              <p className="text-sm text-gray-500">{product.variety}</p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {product.stock.toLocaleString()} ק&quot;ג
              </p>
              <p className="text-xs text-gray-500">₪{product.price_per_kg} לק&quot;ג</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Summary by Warehouse */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">מלאי לפי מחסן</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stockByWarehouse.map((warehouse) => (
            <div
              key={warehouse.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-emerald-300 transition"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">
                  {warehouse.warehouse_type === 'freezing' ? '❄️' : '🌡️'}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
                  <p className="text-sm text-gray-500">
                    {warehouse.warehouse_type === 'freezing' ? 'הקפאה' : 'קירור'} - {warehouse.location}
                  </p>
                </div>
              </div>
              <div className="flex items-end justify-between mt-4">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    {warehouse.stock.toLocaleString()} ק&quot;ג
                  </p>
                  <p className="text-xs text-gray-500">
                    מתוך {warehouse.capacity_kg?.toLocaleString() || 'לא מוגדר'} ק&quot;ג
                  </p>
                </div>
                {warehouse.capacity_kg && (
                  <div className="w-24 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${Math.min((warehouse.stock / warehouse.capacity_kg) * 100, 100)}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">רשימת פלטות</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <select
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">כל המחסנים</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">כל המוצרים</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDepleted}
              onChange={(e) => setShowDepleted(e.target.checked)}
              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
            />
            <span className="text-gray-700">הצג פלטות ריקות</span>
          </label>
        </div>

        {/* Pallets Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">מזהה פלטה</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">מוצר</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">מחסן</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">משקל נוכחי</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">תאריך כניסה</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">אצווה</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-900">סטטוס</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPallets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    לא נמצאו פלטות
                  </td>
                </tr>
              ) : (
                filteredPallets.map((pallet) => (
                  <tr key={pallet.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{pallet.pallet_id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{pallet.product?.name}</p>
                        <p className="text-xs text-gray-500">{pallet.product?.variety}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>
                          {pallet.warehouse?.warehouse_type === 'freezing' ? '❄️' : '🌡️'}
                        </span>
                        <span>{pallet.warehouse?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-emerald-600">
                        {pallet.current_weight_kg.toLocaleString()} ק&quot;ג
                      </span>
                      <span className="text-xs text-gray-500 block">
                        מתוך {pallet.initial_weight_kg.toLocaleString()} ק&quot;ג
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(pallet.entry_date).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {pallet.batch_number || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {pallet.is_depleted ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          ריקה
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          פעילה
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

      {/* Add Pallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">הוספת פלטה חדשה</h2>
            <form onSubmit={handleAddPallet} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מזהה פלטה *
                </label>
                <input
                  type="text"
                  required
                  value={newPallet.pallet_id}
                  onChange={(e) => setNewPallet({ ...newPallet, pallet_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="לדוגמה: PAL-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מחסן *
                </label>
                <select
                  required
                  value={newPallet.warehouse_id}
                  onChange={(e) => setNewPallet({ ...newPallet, warehouse_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">בחר מחסן</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.warehouse_type === 'freezing' ? 'הקפאה' : 'קירור'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מוצר *
                </label>
                <select
                  required
                  value={newPallet.product_id}
                  onChange={(e) => setNewPallet({ ...newPallet, product_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">בחר מוצר</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.variety}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  משקל (ק&quot;ג) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={newPallet.initial_weight_kg}
                  onChange={(e) =>
                    setNewPallet({ ...newPallet, initial_weight_kg: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מספר אצווה
                </label>
                <input
                  type="text"
                  value={newPallet.batch_number}
                  onChange={(e) => setNewPallet({ ...newPallet, batch_number: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="אופציונלי"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  תאריך תפוגה
                </label>
                <input
                  type="date"
                  value={newPallet.expiry_date}
                  onChange={(e) => setNewPallet({ ...newPallet, expiry_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {saving ? 'שומר...' : 'הוסף פלטה'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
