'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Breadcrumbs() {
  const pathname = usePathname()

  if (!pathname) return null

  const paths = pathname.split('/').filter(Boolean)
  
  const breadcrumbMap: Record<string, string> = {
    dashboard: 'דף הבית',
    admin: 'לוח בקרה',
    users: 'ניהול משתמשים',
    distributors: 'ניהול מפיצים',
    customers: 'ניהול לקוחות',
    products: 'ניהול מוצרים',
    inventory: 'ניהול מלאי',
    warehouses: 'ניהול מחסנים',
    'loading-approval': 'אישור טעינה',
    'delivery-sheets': 'דפי משלוח',
    performance: 'ביצועים',
    commissions: 'עמלות',
    'net-to-farm': 'נטו למשק',
    'sales-cycles': 'מחזורי מכירות',
    alerts: 'התראות',
    orders: 'הזמנות',
    new: 'חדש',
    catalog: 'קטלוג תמרים',
    checkout: 'תשלום',
    'team-leader': 'דאשבורד ראש צוות',
  }

  const breadcrumbs = paths.map((path, index) => {
    const href = '/' + paths.slice(0, index + 1).join('/')
    const label = breadcrumbMap[path] || path
    const isLast = index === paths.length - 1

    return {
      href,
      label,
      isLast,
    }
  })

  if (breadcrumbs.length === 0) return null

  return (
    <nav className="mb-4" aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
        <li>
          <Link href="/dashboard" className="hover:text-emerald-600 transition">
            🏠
          </Link>
        </li>
        {breadcrumbs.map((crumb, index) => (
          <li key={crumb.href} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {crumb.isLast ? (
              <span className="text-gray-900 font-semibold">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-emerald-600 transition"
              >
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
