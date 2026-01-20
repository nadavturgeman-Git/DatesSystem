'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Return {
  id: string;
  order_id: string;
  distributor_id: string;
  reason: 'damaged' | 'missed_collection' | 'quality_issue' | 'other';
  description: string | null;
  quantity_kg: number;
  refund_amount: number;
  applied_to_balance: boolean;
  approved_by: string | null;
  is_approved: boolean;
  created_at: string;
  approved_at: string | null;
  order?: { id: string; order_number: string; total_amount: number } | null;
  distributor?: { full_name: string; email: string } | null;
  approver?: { full_name: string } | null;
}

const reasonLabels: Record<string, string> = {
  damaged: 'נזק',
  missed_collection: 'איסוף חסר',
  quality_issue: 'בעיית איכות',
  other: 'אחר',
};

const reasonColors: Record<string, string> = {
  damaged: 'bg-red-100 text-red-800',
  missed_collection: 'bg-yellow-100 text-yellow-800',
  quality_issue: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function AdminReturnsPage() {
  const supabase = createClient();
  
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterReason, setFilterReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('returns')
        .select(`
          *,
          order:orders(id, order_number, total_amount),
          distributor:profiles!returns_distributor_id_fkey(full_name, email),
          approver:profiles!returns_approved_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus === 'approved') {
        query = query.eq('is_approved', true);
      } else if (filterStatus === 'pending') {
        query = query.eq('is_approved', false);
      }
      if (filterReason) {
        query = query.eq('reason', filterReason);
      }

      const { data, error: returnsError } = await query;

      if (returnsError) throw returnsError;
      setReturns(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveReturn(returnId: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('לא מחובר');

      const { error } = await supabase
        .from('returns')
        .update({ 
          is_approved: true,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', returnId);

      if (error) throw error;

      // If applied to balance, update distributor balance
      const returnItem = returns.find(r => r.id === returnId);
      if (returnItem && returnItem.applied_to_balance) {
        // Update distributor balance (add refund amount)
        const { error: balanceError } = await supabase.rpc('update_distributor_balance', {
          distributor_id: returnItem.distributor_id,
          amount: returnItem.refund_amount,
        });

        if (balanceError) {
          console.error('Balance update error:', balanceError);
          // Don't fail the approval if balance update fails
        }
      }

      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function rejectReturn(returnId: string) {
    if (!confirm('האם אתה בטוח שברצונך לדחות החזרה זו?')) return;

    try {
      const { error } = await supabase
        .from('returns')
        .delete()
        .eq('id', returnId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const pendingReturns = returns.filter(r => !r.is_approved);
  const totalRefundAmount = returns.filter(r => r.is_approved).reduce((sum, r) => sum + r.refund_amount, 0);

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
        <h1 className="text-3xl font-bold text-gray-900">↩️ החזרות ונזקים</h1>
        <p className="text-gray-600 mt-2">ניהול החזרות, נזקים וזיכויים</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-orange-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">ממתינות לאישור</h3>
          <p className="text-2xl font-bold text-gray-900">{pendingReturns.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-green-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">סה&quot;כ החזרות</h3>
          <p className="text-2xl font-bold text-gray-900">{returns.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-blue-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">סה&quot;כ זיכויים</h3>
          <p className="text-2xl font-bold text-gray-900">₪{totalRefundAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סטטוס
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">הכל</option>
              <option value="pending">ממתינות לאישור</option>
              <option value="approved">מאושרות</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סיבת החזרה
            </label>
            <select
              value={filterReason}
              onChange={(e) => setFilterReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">כל הסיבות</option>
              <option value="damaged">נזק</option>
              <option value="missed_collection">איסוף חסר</option>
              <option value="quality_issue">בעיית איכות</option>
              <option value="other">אחר</option>
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

      {/* Returns List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">טוען החזרות...</p>
        </div>
      ) : returns.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">אין החזרות להצגה</p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.map((returnItem) => (
            <div
              key={returnItem.id}
              className={`bg-white rounded-lg shadow p-6 border-r-4 ${
                returnItem.is_approved ? 'border-green-500' : 'border-orange-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${reasonColors[returnItem.reason]}`}>
                      {reasonLabels[returnItem.reason]}
                    </span>
                    {returnItem.is_approved ? (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        מאושר
                      </span>
                    ) : (
                      <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        ממתין לאישור
                      </span>
                    )}
                    {returnItem.applied_to_balance ? (
                      <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        יועבר ליתרה
                      </span>
                    ) : (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        נרשם כפסולת
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-sm text-gray-600">מפיץ</p>
                      <p className="font-semibold">{returnItem.distributor?.full_name || 'לא ידוע'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">הזמנה</p>
                      <p className="font-semibold">#{returnItem.order?.order_number || returnItem.order_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">כמות</p>
                      <p className="font-semibold">{returnItem.quantity_kg} ק&quot;ג</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">סכום זיכוי</p>
                      <p className="font-semibold text-emerald-600">₪{returnItem.refund_amount.toLocaleString()}</p>
                    </div>
                  </div>
                  {returnItem.description && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">תיאור</p>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded">{returnItem.description}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>נוצר: {new Date(returnItem.created_at).toLocaleString('he-IL')}</span>
                    {returnItem.approved_at && (
                      <span>אושר: {new Date(returnItem.approved_at).toLocaleString('he-IL')}</span>
                    )}
                    {returnItem.approver && (
                      <span>על ידי: {returnItem.approver.full_name}</span>
                    )}
                  </div>
                </div>
                {!returnItem.is_approved && (
                  <div className="flex flex-col gap-2 mr-4">
                    <button
                      onClick={() => approveReturn(returnItem.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      אישר החזרה
                    </button>
                    <button
                      onClick={() => rejectReturn(returnItem.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      דחה
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
