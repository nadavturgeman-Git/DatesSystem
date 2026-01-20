'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { User } from '@supabase/supabase-js'

interface SidebarProps {
  user: User
  profile: any
}

interface NavItem {
  name: string
  href: string
  icon: string
  roles?: ('admin' | 'team_leader' | 'distributor')[]
  badge?: string
}

export default function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Navigation items based on role
  const navItems: NavItem[] = [
    {
      name: 'דף הבית',
      href: '/dashboard',
      icon: '🏠',
      roles: ['admin', 'team_leader', 'distributor'],
    },
    {
      name: 'קטלוג תמרים',
      href: '/catalog',
      icon: '🛒',
      roles: ['admin', 'team_leader', 'distributor'],
    },
    {
      name: 'הזמנות',
      href: '/orders',
      icon: '📋',
      roles: ['admin', 'team_leader', 'distributor'],
    },
    {
      name: 'הזמנה חדשה',
      href: '/orders/new',
      icon: '➕',
      roles: ['admin', 'team_leader', 'distributor'],
    },
    // Admin only
    {
      name: 'לוח בקרה',
      href: '/admin',
      icon: '👑',
      roles: ['admin'],
    },
    {
      name: 'ניהול משתמשים',
      href: '/admin/users',
      icon: '👥',
      roles: ['admin'],
    },
    {
      name: 'ניהול מפיצים',
      href: '/admin/distributors',
      icon: '📦',
      roles: ['admin'],
    },
    {
      name: 'ניהול לקוחות',
      href: '/admin/customers',
      icon: '👤',
      roles: ['admin'],
    },
    {
      name: 'ניהול מוצרים',
      href: '/admin/products',
      icon: '🌴',
      roles: ['admin'],
    },
    {
      name: 'ניהול מלאי',
      href: '/admin/inventory',
      icon: '📊',
      roles: ['admin'],
    },
    {
      name: 'ניהול מחסנים',
      href: '/admin/warehouses',
      icon: '🏭',
      roles: ['admin'],
    },
    {
      name: 'אישור טעינה',
      href: '/admin/loading-approval',
      icon: '🚚',
      roles: ['admin'],
    },
    {
      name: 'דפי משלוח',
      href: '/admin/delivery-sheets',
      icon: '📄',
      roles: ['admin'],
    },
    {
      name: 'ביצועים',
      href: '/admin/performance',
      icon: '📈',
      roles: ['admin'],
    },
    {
      name: 'עמלות',
      href: '/admin/commissions',
      icon: '💰',
      roles: ['admin'],
    },
    {
      name: 'נטו למשק',
      href: '/admin/net-to-farm',
      icon: '🌾',
      roles: ['admin'],
    },
    {
      name: 'מחזורי מכירות',
      href: '/admin/sales-cycles',
      icon: '🔄',
      roles: ['admin'],
    },
    {
      name: 'התראות',
      href: '/admin/alerts',
      icon: '🔔',
      roles: ['admin'],
    },
    // Team Leader
    {
      name: 'דאשבורד ראש צוות',
      href: '/team-leader',
      icon: '👥',
      roles: ['team_leader'],
    },
    // Distributor
    {
      name: 'קישור הזמנה ציבורי',
      href: '/distributor/public-link',
      icon: '🔗',
      roles: ['distributor'],
    },
    {
      name: 'עמלות שלי',
      href: '/distributor/commissions',
      icon: '💰',
      roles: ['distributor'],
    },
  ]

  // Filter items based on user role
  // If profile is null, show all items (fallback)
  const filteredItems = navItems.filter(
    (item) => !item.roles || !profile || item.roles.includes(profile?.role)
  )

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 right-4 z-50 bg-white p-2 rounded-lg shadow-lg border border-gray-200"
        aria-label="תפריט"
      >
        {isMobileMenuOpen ? (
          <span className="text-2xl">✕</span>
        ) : (
          <span className="text-2xl">☰</span>
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed right-0 top-0 h-full w-64 bg-white border-l border-gray-200 shadow-lg z-40
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo/Header */}
        <div className="p-6 border-b border-gray-200">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="text-3xl">🌴</div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">מערכת תמרים</h1>
              <p className="text-xs text-gray-500">ניהול מלאי ומכירות</p>
            </div>
          </Link>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-600 font-bold">
                {profile?.full_name?.[0] || user.email?.[0] || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {profile?.full_name || user.email || 'ללא שם'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              {profile?.role && (
                <p
                  className={`text-xs font-semibold mt-1 ${
                    profile.role === 'admin'
                      ? 'text-purple-600'
                      : profile.role === 'team_leader'
                      ? 'text-blue-600'
                      : 'text-green-600'
                  }`}
                >
                  {profile.role === 'admin'
                    ? '👑 מנהל'
                    : profile.role === 'team_leader'
                    ? '👥 ראש צוות'
                    : '📦 מפיץ'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1">
            {filteredItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                    ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 font-semibold border-r-4 border-emerald-600'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-emerald-600'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <Link
            href="/catalog"
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-center justify-center font-semibold"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span>🛒</span>
            <span>קטלוג תמרים</span>
          </Link>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  )
}
