import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function AdminPage() {
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

  // Check if user is admin
  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  // Get stats for admin dashboard
  const [
    { data: warehouses },
    { data: products },
    { data: pallets },
    { data: orders },
    { data: distributors },
    { data: customers },
    { data: alerts },
  ] = await Promise.all([
    supabase.from('warehouses').select('*'),
    supabase.from('products').select('*'),
    supabase.from('pallets').select('current_weight_kg, is_depleted').eq('is_depleted', false),
    supabase.from('orders').select('id, status, payment_status').limit(100),
    supabase.from('profiles').select('id, full_name, email, role').eq('role', 'distributor'),
    supabase.from('customers').select('id').limit(100),
    supabase.from('alerts').select('id, is_read').eq('is_read', false),
  ]);

  const totalInventory = pallets?.reduce((sum, p) => sum + (p.current_weight_kg || 0), 0) || 0;
  const pendingOrders = orders?.filter((o) => o.status === 'pending').length || 0;
  const unpaidOrders = orders?.filter((o) => o.payment_status === 'pending').length || 0;
  const unreadAlerts = alerts?.length || 0;

  const adminModules = [
    {
      title: 'ניהול מלאי',
      description: 'צפייה וניהול פלטות, מלאי, ומחסנים',
      icon: '📦',
      href: '/admin/inventory',
      color: 'from-blue-500 to-blue-600',
      stats: `${totalInventory.toLocaleString()} ק&quot;ג`,
    },
    {
      title: 'ניהול הזמנות',
      description: 'כל ההזמנות במערכת, סטטוסים ותשלומים',
      icon: '📋',
      href: '/orders',
      color: 'from-purple-500 to-purple-600',
      stats: `${orders?.length || 0} הזמנות`,
      badge: pendingOrders > 0 ? `${pendingOrders} ממתינות` : null,
    },
    {
      title: 'ניהול מפיצים',
      description: 'מפיצים, ראשי צוותים, הרשאות ועמלות',
      icon: '👥',
      href: '/admin/distributors',
      color: 'from-green-500 to-green-600',
      stats: `${distributors?.length || 0} מפיצים`,
    },
    {
      title: 'ניהול משתמשים',
      description: 'ניהול מלא של כל המשתמשים: מנהלים, ראשי צוותים, מפיצים',
      icon: '👤',
      href: '/admin/users',
      color: 'from-slate-500 to-slate-600',
      stats: 'כל המשתמשים',
    },
    {
      title: 'ניהול לקוחות',
      description: 'לקוחות קצה, CRM, והזמנות עצמיות',
      icon: '👤',
      href: '/admin/customers',
      color: 'from-orange-500 to-orange-600',
      stats: `${customers?.length || 0} לקוחות`,
    },
    {
      title: 'ניהול מוצרים',
      description: 'מוצרים, מחירים, וזני תמרים',
      icon: '🌴',
      href: '/admin/products',
      color: 'from-emerald-500 to-emerald-600',
      stats: `${products?.length || 0} מוצרים`,
    },
    {
      title: 'ניהול מחסנים',
      description: 'מחסני הקפאה וקירור, קיבולת ואזהרות',
      icon: '🏭',
      href: '/admin/warehouses',
      color: 'from-indigo-500 to-indigo-600',
      stats: `${warehouses?.length || 0} מחסנים`,
    },
    {
      title: 'דוחות ועמלות',
      description: 'דוחות מכירות, עמלות מפיצים ותשלומים',
      icon: '💰',
      href: '/admin/commissions',
      color: 'from-yellow-500 to-yellow-600',
      stats: unpaidOrders > 0 ? `${unpaidOrders} לא שולמו` : 'כל התשלומים',
    },
    {
      title: 'נטו למשק',
      description: 'דוח פיננסי: הכנסות פחות עמלות = נטו למשק',
      icon: '💵',
      href: '/admin/net-to-farm',
      color: 'from-emerald-500 to-teal-600',
      stats: 'דוח פיננסי',
    },
    {
      title: 'דפי משלוח',
      description: 'יצירת דפי משלוח לנהגים, מעקב משלוחים',
      icon: '🚚',
      href: '/admin/delivery-sheets',
      color: 'from-teal-500 to-teal-600',
      stats: 'דפי משלוח',
    },
    {
      title: 'החזרות ונזקים',
      description: 'ניהול החזרות, נזקים וזיכויים',
      icon: '↩️',
      href: '/admin/returns',
      color: 'from-red-500 to-red-600',
      stats: 'החזרות',
    },
    {
      title: 'התראות',
      description: 'התראות מערכת, אזהרות קלקול וביצועים',
      icon: '🔔',
      href: '/admin/alerts',
      color: 'from-pink-500 to-pink-600',
      stats: unreadAlerts > 0 ? `${unreadAlerts} לא נקראו` : 'אין התראות',
      badge: unreadAlerts > 0 ? `${unreadAlerts}` : null,
    },
    {
      title: 'ביצועים ומדדים',
      description: 'מעקב ביצועים, כלל 50 ק&quot;ג ומדדי מכירות',
      icon: '📊',
      href: '/admin/performance',
      color: 'from-cyan-500 to-cyan-600',
      stats: 'מדדים',
    },
    {
      title: 'מחזורי מכירה',
      description: 'ניהול חלונות הזמנה ומחזורי מכירה',
      icon: '🔄',
      href: '/admin/sales-cycles',
      color: 'from-violet-500 to-violet-600',
      stats: 'מחזורים',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">לוח בקרה - מנהל</h1>
        <p className="text-gray-600">ניהול מלא של כל המערכת</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">מלאי כולל</h3>
          <p className="text-3xl font-bold">{totalInventory.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-1">ק&quot;ג</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">הזמנות ממתינות</h3>
          <p className="text-3xl font-bold">{pendingOrders}</p>
          <p className="text-xs opacity-75 mt-1">הזמנות</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">תשלומים ממתינים</h3>
          <p className="text-3xl font-bold">{unpaidOrders}</p>
          <p className="text-xs opacity-75 mt-1">הזמנות</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 text-white">
          <h3 className="text-sm font-semibold mb-2 opacity-90">התראות לא נקראו</h3>
          <p className="text-3xl font-bold">{unreadAlerts}</p>
          <p className="text-xs opacity-75 mt-1">התראות</p>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">מודולי ניהול</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminModules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-200 p-6 border border-gray-200 hover:border-emerald-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${module.color} flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform`}>
                  {module.icon}
                </div>
                {module.badge && (
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {module.badge}
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition-colors">
                {module.title}
              </h3>
              <p className="text-gray-600 text-sm mb-4">{module.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{module.stats}</span>
                <span className="text-emerald-600 font-medium group-hover:translate-x-[-4px] transition-transform">
                  לניהול →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
