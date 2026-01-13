import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get warehouses
  const { data: warehouses } = await supabase
    .from('warehouses')
    .select('*')
    .eq('is_active', true);

  // Get products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  // Get total inventory (sum of all pallets)
  const { data: pallets } = await supabase
    .from('pallets')
    .select('current_weight_kg')
    .eq('is_depleted', false);

  const totalInventory = pallets?.reduce((sum, pallet) => sum + (pallet.current_weight_kg || 0), 0) || 0;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          שלום, {profile?.full_name || user.email}!
        </h1>
        <p className="text-gray-600">
          תפקיד: <span className="font-semibold">{profile?.role === 'admin' ? 'מנהל' : profile?.role === 'team_leader' ? 'ראש צוות' : 'מפיץ'}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Inventory */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">מלאי כולל</h3>
          <p className="text-4xl font-bold">{totalInventory.toLocaleString()}</p>
          <p className="text-sm opacity-90 mt-1">ק"ג</p>
        </div>

        {/* Warehouses */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">מחסנים פעילים</h3>
          <p className="text-4xl font-bold">{warehouses?.length || 0}</p>
          <p className="text-sm opacity-90 mt-1">מחסנים</p>
        </div>

        {/* Products */}
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">מוצרים</h3>
          <p className="text-4xl font-bold">{products?.length || 0}</p>
          <p className="text-sm opacity-90 mt-1">סוגי תמרים</p>
        </div>
      </div>

      {/* Warehouses List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">מחסנים</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {warehouses?.map((warehouse) => (
            <div
              key={warehouse.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">{warehouse.name}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    warehouse.warehouse_type === 'freezing'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {warehouse.warehouse_type === 'freezing' ? 'הקפאה' : 'קירור'}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-1">מיקום: {warehouse.location}</p>
              <p className="text-gray-600 text-sm">
                קיבולת: {warehouse.capacity_kg?.toLocaleString()} ק"ג
              </p>
              {warehouse.spoilage_alert_days && (
                <p className="text-amber-600 text-sm mt-2">
                  ⚠️ התראת קלקול: {warehouse.spoilage_alert_days} ימים
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">מוצרים</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מוצר
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  זן
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מחיר לק"ג
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products?.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {product.variety}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₪{product.price_per_kg}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
