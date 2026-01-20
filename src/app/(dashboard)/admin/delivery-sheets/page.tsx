'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface DeliverySheet {
  id: string;
  sheet_number: string;
  driver_name: string | null;
  delivery_date: string;
  spare_inventory_kg: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  creator?: { full_name: string } | null;
  items?: DeliverySheetItem[];
}

interface DeliverySheetItem {
  id: string;
  delivery_sheet_id: string;
  distributor_id: string;
  product_id: string;
  quantity_kg: number;
  distributor?: { full_name: string } | null;
  product?: { name: string; variety: string } | null;
}

export default function AdminDeliverySheetsPage() {
  const supabase = createClient();
  
  const [sheets, setSheets] = useState<DeliverySheet[]>([]);
  const [distributors, setDistributors] = useState<{ id: string; full_name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; variety: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    driver_name: '',
    delivery_date: new Date().toISOString().split('T')[0],
    spare_inventory_kg: '',
    notes: '',
  });
  const [items, setItems] = useState<Array<{ distributor_id: string; product_id: string; quantity_kg: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [sheetsRes, distributorsRes, productsRes] = await Promise.all([
        supabase
          .from('delivery_sheets')
          .select(`
            *,
            creator:profiles!delivery_sheets_created_by_fkey(full_name),
            items:delivery_sheet_items(
              *,
              distributor:profiles!delivery_sheet_items_distributor_id_fkey(full_name),
              product:products!delivery_sheet_items_product_id_fkey(name, variety)
            )
          `)
          .order('delivery_date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'distributor')
          .order('full_name'),
        supabase
          .from('products')
          .select('id, name, variety')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (sheetsRes.error) throw sheetsRes.error;
      if (distributorsRes.error) throw distributorsRes.error;
      if (productsRes.error) throw productsRes.error;

      setSheets(sheetsRes.data || []);
      setDistributors(distributorsRes.data || []);
      setProducts(productsRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setFormData({
      driver_name: '',
      delivery_date: new Date().toISOString().split('T')[0],
      spare_inventory_kg: '',
      notes: '',
    });
    setItems([]);
    setShowModal(true);
  }

  function addItem() {
    setItems([...items, { distributor_id: '', product_id: '', quantity_kg: '' }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: string, value: string) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא מחובר');

      // Generate sheet number
      const sheetNumber = `DS-${Date.now()}`;

      // Create delivery sheet
      const { data: sheet, error: sheetError } = await supabase
        .from('delivery_sheets')
        .insert({
          sheet_number: sheetNumber,
          driver_name: formData.driver_name || null,
          delivery_date: formData.delivery_date,
          spare_inventory_kg: parseFloat(formData.spare_inventory_kg) || 0,
          notes: formData.notes || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (sheetError) throw sheetError;

      // Create items
      if (items.length > 0) {
        const validItems = items.filter(
          item => item.distributor_id && item.product_id && item.quantity_kg
        );

        if (validItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('delivery_sheet_items')
            .insert(
              validItems.map(item => ({
                delivery_sheet_id: sheet.id,
                distributor_id: item.distributor_id,
                product_id: item.product_id,
                quantity_kg: parseFloat(item.quantity_kg),
              }))
            );

          if (itemsError) throw itemsError;
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

  async function markAsCompleted(sheetId: string) {
    try {
      const { error } = await supabase
        .from('delivery_sheets')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', sheetId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

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
          <h1 className="text-3xl font-bold text-gray-900">🚚 דפי משלוח</h1>
          <p className="text-gray-600 mt-2">יצירת דפי משלוח לנהגים, מעקב משלוחים</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          + צור דף משלוח חדש
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Sheets List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">טוען דפי משלוח...</p>
        </div>
      ) : sheets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">אין דפי משלוח</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sheets.map((sheet) => (
            <div
              key={sheet.id}
              className={`bg-white rounded-lg shadow p-6 border-r-4 ${
                sheet.completed_at ? 'border-green-500' : 'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      דף משלוח #{sheet.sheet_number}
                    </h3>
                    {sheet.completed_at ? (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        הושלם
                      </span>
                    ) : (
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        פעיל
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <strong>תאריך משלוח:</strong> {new Date(sheet.delivery_date).toLocaleDateString('he-IL')}
                    </div>
                    {sheet.driver_name && (
                      <div>
                        <strong>נהג:</strong> {sheet.driver_name}
                      </div>
                    )}
                    <div>
                      <strong>מלאי חלופי:</strong> {sheet.spare_inventory_kg} ק&quot;ג
                    </div>
                  </div>
                </div>
                {!sheet.completed_at && (
                  <button
                    onClick={() => markAsCompleted(sheet.id)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    סמן כהושלם
                  </button>
                )}
              </div>

              {sheet.items && sheet.items.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">פריטי משלוח:</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">מפיץ</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">מוצר</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">כמות</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sheet.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.distributor?.full_name || 'לא ידוע'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.product?.name || 'לא ידוע'}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.quantity_kg} ק&quot;ג
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {sheet.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <strong>הערות:</strong> {sheet.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">צור דף משלוח חדש</h2>
              
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      שם נהג
                    </label>
                    <input
                      type="text"
                      value={formData.driver_name}
                      onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      תאריך משלוח *
                    </label>
                    <input
                      type="date"
                      value={formData.delivery_date}
                      onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      מלאי חלופי (ק&quot;ג)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.spare_inventory_kg}
                      onChange={(e) => setFormData({ ...formData, spare_inventory_kg: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
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

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      פריטי משלוח
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm"
                    >
                      + הוסף פריט
                    </button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <select
                            value={item.distributor_id}
                            onChange={(e) => updateItem(index, 'distributor_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">בחר מפיץ</option>
                            {distributors.map((d) => (
                              <option key={d.id} value={d.id}>{d.full_name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select
                            value={item.product_id}
                            onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">בחר מוצר</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} - {p.variety}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.01"
                            placeholder='ק"ג'
                            value={item.quantity_kg}
                            onChange={(e) => updateItem(index, 'quantity_kg', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
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
