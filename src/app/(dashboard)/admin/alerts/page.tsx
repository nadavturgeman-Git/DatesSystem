'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Alert {
  id: string;
  alert_type: 'low_performance' | 'spoilage_warning' | 'stock_low' | 'reservation_expired';
  target_user_id: string | null;
  title: string;
  message: string;
  metadata: any;
  is_read: boolean;
  is_resolved: boolean;
  created_at: string;
  resolved_at: string | null;
  target_user?: { full_name: string; email: string } | null;
}

const alertTypeLabels: Record<string, string> = {
  low_performance: 'ביצועים נמוכים',
  spoilage_warning: 'אזהרת קלקול',
  stock_low: 'מלאי נמוך',
  reservation_expired: 'הזמנה פגה',
};

const alertTypeColors: Record<string, string> = {
  low_performance: 'bg-orange-100 text-orange-800 border-orange-300',
  spoilage_warning: 'bg-red-100 text-red-800 border-red-300',
  stock_low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  reservation_expired: 'bg-blue-100 text-blue-800 border-blue-300',
};

export default function AdminAlertsPage() {
  const supabase = createClient();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filterType, setFilterType] = useState('');
  const [showRead, setShowRead] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('alerts')
        .select('*, target_user:profiles!alerts_target_user_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });

      if (!showRead) {
        query = query.eq('is_read', false);
      }
      if (!showResolved) {
        query = query.eq('is_resolved', false);
      }
      if (filterType) {
        query = query.eq('alert_type', filterType);
      }

      const { data, error: alertsError } = await query;

      if (alertsError) throw alertsError;
      setAlerts(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(alertId: string) {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function markAsResolved(alertId: string) {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ 
          is_resolved: true,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function markAllAsRead() {
    try {
      const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
      if (unreadIds.length === 0) return;

      const { error } = await supabase
        .from('alerts')
        .update({ is_read: true })
        .in('id', unreadIds);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const filteredAlerts = alerts;
  const unreadCount = alerts.filter(a => !a.is_read).length;
  const unresolvedCount = alerts.filter(a => !a.is_resolved).length;

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
          <h1 className="text-3xl font-bold text-gray-900">🔔 התראות</h1>
          <p className="text-gray-600 mt-2">התראות מערכת, אזהרות קלקול וביצועים</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium"
          >
            סמן הכל כנקרא ({unreadCount})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-red-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">לא נקראו</h3>
          <p className="text-2xl font-bold text-gray-900">{unreadCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-orange-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">לא נפתרו</h3>
          <p className="text-2xl font-bold text-gray-900">{unresolvedCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-blue-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">סה&quot;כ התראות</h3>
          <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סוג התראה
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">כל הסוגים</option>
              <option value="low_performance">ביצועים נמוכים</option>
              <option value="spoilage_warning">אזהרת קלקול</option>
              <option value="stock_low">מלאי נמוך</option>
              <option value="reservation_expired">הזמנה פגה</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRead}
                onChange={(e) => setShowRead(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">הצג נקראו</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-gray-700">הצג נפתרו</span>
            </label>
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

      {/* Alerts List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">טוען התראות...</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">אין התראות להצגה</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-lg shadow p-6 border-r-4 ${
                alert.is_read ? 'opacity-75' : ''
              } ${
                alert.alert_type === 'spoilage_warning' ? 'border-red-500' :
                alert.alert_type === 'low_performance' ? 'border-orange-500' :
                alert.alert_type === 'stock_low' ? 'border-yellow-500' :
                'border-blue-500'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${alertTypeColors[alert.alert_type]}`}>
                      {alertTypeLabels[alert.alert_type]}
                    </span>
                    {!alert.is_read && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        חדש
                      </span>
                    )}
                    {alert.is_resolved && (
                      <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        נפתר
                      </span>
                    )}
                    {alert.target_user && (
                      <span className="text-sm text-gray-600">
                        עבור: {alert.target_user.full_name}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{alert.title}</h3>
                  <p className="text-gray-700 mb-3">{alert.message}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{new Date(alert.created_at).toLocaleString('he-IL')}</span>
                    {alert.resolved_at && (
                      <span>נפתר: {new Date(alert.resolved_at).toLocaleString('he-IL')}</span>
                    )}
                  </div>
                  {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <strong>פרטים נוספים:</strong>
                      <pre className="mt-1 text-gray-600">{JSON.stringify(alert.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 mr-4">
                  {!alert.is_read && (
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      סמן כנקרא
                    </button>
                  )}
                  {!alert.is_resolved && (
                    <button
                      onClick={() => markAsResolved(alert.id)}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      סמן כנפתר
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
