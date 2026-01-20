'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface PerformanceMetric {
  id: string;
  distributor_id: string;
  sales_cycle_start: string;
  sales_cycle_end: string;
  total_weight_kg: number;
  total_orders: number;
  total_revenue: number;
  met_minimum_threshold: boolean;
  created_at: string;
  updated_at: string;
  distributor?: { full_name: string; email: string } | null;
}

export default function AdminPerformancePage() {
  const supabase = createClient();
  
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<Array<{ id: string; full_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [filterDistributor, setFilterDistributor] = useState('');
  const [filterTeamLeader, setFilterTeamLeader] = useState('');
  const [filterThreshold, setFilterThreshold] = useState('');

  useEffect(() => {
    loadTeamLeaders();
    loadData();
  }, [filterTeamLeader, filterThreshold]);

  async function loadTeamLeaders() {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'team_leader')
        .order('full_name');
      setTeamLeaders(data || []);
    } catch (err) {
      console.error('Error loading team leaders:', err);
    }
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      let query = supabase
        .from('performance_metrics')
        .select(`
          *,
          distributor:profiles!performance_metrics_distributor_id_fkey(
            full_name,
            email,
            team_leader_id,
            team_leader:profiles!profiles_team_leader_id_fkey(full_name)
          )
        `)
        .order('sales_cycle_start', { ascending: false });

      if (filterDistributor) {
        query = query.eq('distributor_id', filterDistributor);
      }
      if (filterThreshold === 'met') {
        query = query.eq('met_minimum_threshold', true);
      } else if (filterThreshold === 'not_met') {
        query = query.eq('met_minimum_threshold', false);
      }

      const { data, error: metricsError } = await query;

      if (metricsError) throw metricsError;
      
      // Filter by team leader if selected
      let filteredData = data || [];
      if (filterTeamLeader) {
        filteredData = filteredData.filter((m: any) => 
          m.distributor?.team_leader_id === filterTeamLeader
        );
      }
      
      setMetrics(filteredData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalWeight = metrics.reduce((sum, m) => sum + m.total_weight_kg, 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + m.total_revenue, 0);
  const metThreshold = metrics.filter(m => m.met_minimum_threshold).length;
  const notMetThreshold = metrics.filter(m => !m.met_minimum_threshold).length;

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
        <h1 className="text-3xl font-bold text-gray-900">📊 ביצועים ומדדים</h1>
        <p className="text-gray-600 mt-2">מעקב ביצועים, כלל 50 ק&quot;ג ומדדי מכירות</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-blue-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">סה&quot;כ משקל</h3>
          <p className="text-2xl font-bold text-gray-900">{totalWeight.toLocaleString()} ק&quot;ג</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-green-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">סה&quot;כ הכנסות</h3>
          <p className="text-2xl font-bold text-gray-900">₪{totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-emerald-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">עמדו ב-50 ק&quot;ג</h3>
          <p className="text-2xl font-bold text-gray-900">{metThreshold}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border-r-4 border-orange-500">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">לא עמדו ב-50 ק&quot;ג</h3>
          <p className="text-2xl font-bold text-gray-900">{notMetThreshold}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              אזור (ראש צוות)
            </label>
            <select
              value={filterTeamLeader}
              onChange={(e) => setFilterTeamLeader(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">כל האזורים</option>
              {teamLeaders.map((tl) => (
                <option key={tl.id} value={tl.id}>
                  {tl.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              סטטוס כלל 50 ק&quot;ג
            </label>
            <select
              value={filterThreshold}
              onChange={(e) => setFilterThreshold(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">הכל</option>
              <option value="met">עמדו ב-50 ק&quot;ג</option>
              <option value="not_met">לא עמדו ב-50 ק&quot;ג</option>
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

      {/* Metrics List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          <p className="mt-4 text-gray-600">טוען מדדי ביצועים...</p>
        </div>
      ) : metrics.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">אין מדדי ביצועים להצגה</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מפיץ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">ראש צוות</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">תקופת מכירה</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">משקל כולל</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מספר הזמנות</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">הכנסות</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">כלל 50 ק&quot;ג</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.map((metric) => (
                  <tr key={metric.id} className={metric.met_minimum_threshold ? 'bg-green-50' : 'bg-orange-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {metric.distributor?.full_name || 'לא ידוע'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {(metric.distributor as any)?.team_leader?.full_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(metric.sales_cycle_start).toLocaleDateString('he-IL')} - {new Date(metric.sales_cycle_end).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.total_weight_kg.toLocaleString()} ק&quot;ג
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {metric.total_orders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-600">
                      ₪{metric.total_revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {metric.met_minimum_threshold ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          ✓ עמד
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">
                          ✗ לא עמד
                        </span>
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
