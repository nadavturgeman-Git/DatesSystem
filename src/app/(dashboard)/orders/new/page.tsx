'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Product {
  id: string;
  name: string;
  variety: string;
  price_per_kg: number;
}

interface OrderItem {
  productId: string;
  quantity: number;
}

interface PreviewItem {
  productId: string;
  productName: string;
  quantity: number;
  pricePerKg: number;
  itemTotal: number;
  allocation: any[];
  fullyFulfilled: boolean;
  actualWeight: number;
}

export default function NewOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([{ productId: '', quantity: 0 }]);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('is_active', true);
    if (data) setProducts(data);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { productId: '', quantity: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderItems(newItems);
  };

  const handlePreview = async () => {
    setError('');
    setLoading(true);

    // Validate items
    const validItems = orderItems.filter((item) => item.productId && item.quantity > 0);

    if (validItems.length === 0) {
      setError('אנא הוסף לפחות מוצר אחד עם כמות');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/orders/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: validItems }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'שגיאה בטעינת תצוגה מקדימה');
        return;
      }

      setPreview(data.preview);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    setError('');
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError('יש להתחבר תחילה');
        return;
      }

      // Create order via API
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributorId: user.id,
          items: orderItems.filter((item) => item.productId && item.quantity > 0),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'שגיאה ביצירת הזמנה');
        return;
      }

      // Success! Redirect to order details
      router.push(`/orders/${data.order.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900">הזמנה חדשה</h1>
        <p className="text-gray-600 mt-2">בחר מוצרים וכמויות. המערכת תקצה אוטומטית לפי FIFO</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Order Items Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">מוצרים</h2>

        <div className="space-y-4">
          {orderItems.map((item, index) => (
            <div key={index} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  מוצר
                </label>
                <select
                  value={item.productId}
                  onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">בחר מוצר</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ₪{product.price_per_kg}/ק"ג
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-40">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  כמות (ק"ג)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.quantity || ''}
                  onChange={(e) =>
                    handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  placeholder="0"
                />
              </div>

              {orderItems.length > 1 && (
                <button
                  onClick={() => handleRemoveItem(index)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition"
                >
                  הסר
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4">
          <button
            onClick={handleAddItem}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
          >
            + הוסף מוצר
          </button>

          <button
            onClick={handlePreview}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'הצג תצוגה מקדימה'}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <>
          {/* FIFO Allocation Preview */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">הקצאת FIFO</h2>

            <div className="space-y-4">
              {preview.items.map((item: PreviewItem, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{item.productName}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.fullyFulfilled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.fullyFulfilled ? 'זמין במלאי' : 'לא זמין במלאי'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">
                    מבוקש: {item.quantity} ק"ג | משוקצה: {item.actualWeight} ק"ג
                  </p>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">פלטות מוקצות:</p>
                    {item.allocation.map((alloc: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 rounded p-2 text-sm"
                      >
                        <span className="text-gray-700">
                          פלטה #{i + 1} ({new Date(alloc.entry_date).toLocaleDateString('he-IL')})
                        </span>
                        <span className="font-medium">{alloc.allocatedWeight} ק"ג</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">סיכום הזמנה</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-gray-700">
                <span>משקל כולל:</span>
                <span className="font-semibold">{preview.totalWeight.toFixed(2)} ק"ג</span>
              </div>

              <div className="flex justify-between text-gray-700">
                <span>סכום חלקי:</span>
                <span className="font-semibold">₪{preview.subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-emerald-600">
                <span>עמלה ({preview.commissionRate}%):</span>
                <span className="font-semibold">₪{preview.commissionAmount.toFixed(2)}</span>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>סה"כ לתשלום:</span>
                  <span>₪{preview.totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateOrder}
              disabled={loading}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'יוצר הזמנה...' : 'צור הזמנה (שמור למשך 30 דקות)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
