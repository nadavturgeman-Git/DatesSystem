'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Commission {
  id: string;
  user_id: string;
  order_id: string;
  commission_type: 'distributor' | 'team_leader';
  payment_type: 'cash' | 'goods';
  settlement_type?: 'invoice_payslip' | 'group_discount'; // Group Discount vs Invoice/Payslip
  base_amount: number;
  commission_rate: number;
  commission_amount: number;
  product_id: string | null;
  product_quantity_kg: number | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
  user?: { full_name: string; email: string } | null;
  order?: { order_number: string; total_amount: number } | null;
  product?: { name: string } | null;
}

export default function AdminCommissionsPage() {
  const supabase = createClient();
  
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('');
  const [filterPaymentType, setFilterPaymentType] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('commissions')
        .select(`
          *,
          user:profiles!commissions_user_id_fkey(full_name, email),
          order:orders(id, order_number, total_amount),
          product:products!commissions_product_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (filterType) {
        query = query.eq('commission_type', filterType);
      }
      if (filterPaymentStatus === 'paid') {
        query = query.eq('is_paid', true);
      } else if (filterPaymentStatus === 'unpaid') {
        query = query.eq('is_paid', false);
      }
      if (filterPaymentType) {
        query = query.eq('payment_type', filterPaymentType);
      }

      const { data, error: commissionsError } = await query;

      if (commissionsError) throw commissionsError;
      setCommissions(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function markAsPaid(commissionId: string) {
    try {
      const { error } = await supabase
        .from('commissions')
        .update({ 
          is_paid: true,
          paid_at: new Date().toISOString(),
        })
        .eq('id', commissionId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const totalCommissions = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
  const paidCommissions = commissions.filter(c => c.is_paid).reduce((sum, c) => sum + c.commission_amount, 0);
  const unpaidCommissions = commissions.filter(c => !c.is_paid).reduce((sum, c) => sum + c.commission_amount, 0);
  const unpaidCount = commissions.filter(c => !c.is_paid).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin"
          className="text-emerald-600 hover:text-emerald-700 mb-4 inline-block"
        >
          ← חזרה ללוח בקרה
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">💰 דוחות ועמלות</h1>
        <p className="text-gray-600 mt-2">דוחות מכירות, עמלות מפיצים ותשלומים</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-blue-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">סה&quot;כ עמלות</h3>
          <p className="text-2xl font-bold text-gray-900">₪{totalCommissions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-green-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">שולמו</h3>
          <p className="text-2xl font-bold text-gray-900">₪{paidCommissions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-orange-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">לא שולמו</h3>
          <p className="text-2xl font-bold text-gray-900">₪{unpaidCommissions.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-red-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">ממתינות תשלום</h3>
          <p className="text-2xl font-bold text-gray-900">{unpaidCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סוג עמלה
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">הכל</option>
              <option value="distributor">מפיץ</option>
              <option value="team_leader">ראש צוות</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סטטוס תשלום
            </label>
            <select
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">הכל</option>
              <option value="paid">שולם</option>
              <option value="unpaid">לא שולם</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סוג תשלום
            </label>
            <select
              value={filterPaymentType}
              onChange={(e) => setFilterPaymentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">הכל</option>
              <option value="cash">מזומן</option>
              <option value="goods">מוצרים</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadData}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
            >
              רענן
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Commissions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">טוען עמלות...</p>
        </div>
      ) : commissions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">אין עמלות להצגה</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תאריך
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    מפיץ/ראש צוות
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סוג הסדר
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    הזמנה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סוג
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סכום בסיס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    אחוז
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    עמלה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    תשלום
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    סטטוס
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {commissions.map((commission) => (
                  <tr key={commission.id} className={commission.is_paid ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(commission.created_at).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {commission.user?.full_name || 'לא ידוע'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          commission.settlement_type === 'group_discount'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {commission.settlement_type === 'group_discount'
                          ? 'הנחה קבוצתית'
                          : commission.settlement_type === 'invoice_payslip'
                          ? 'חשבונית/תלוש'
                          : 'לא מוגדר'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{commission.order?.order_number || commission.order_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        commission.commission_type === 'distributor' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {commission.commission_type === 'distributor' ? 'מפיץ' : 'ראש צוות'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₪{commission.base_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {commission.commission_rate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      ₪{commission.commission_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        commission.payment_type === 'cash' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {commission.payment_type === 'cash' ? 'מזומן' : 'מוצרים'}
                      </span>
                      {commission.payment_type === 'goods' && commission.product && (
                        <div className="text-xs text-gray-600 mt-1">
                          {commission.product_quantity_kg} ק&quot;ג {commission.product.name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {commission.is_paid ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          שולם
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          לא שולם
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {!commission.is_paid && (
                        <button
                          onClick={() => markAsPaid(commission.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-medium"
                        >
                          סמן כשולם
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
