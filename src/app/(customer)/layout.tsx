import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple top navigation for customer pages */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/catalog" className="flex items-center gap-2">
              <span className="text-2xl">🌴</span>
              <span className="text-xl font-bold text-gray-900">תמרים</span>
            </Link>

            {/* Navigation */}
            <div className="flex items-center gap-4">
              <Link
                href="/catalog"
                className="text-gray-700 hover:text-emerald-600 font-medium transition px-3 py-2 rounded-lg hover:bg-gray-50"
              >
                קטלוג
              </Link>
              {user && (
                <Link
                  href="/my-orders"
                  className="text-gray-700 hover:text-emerald-600 font-medium transition px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  ההזמנות שלי
                </Link>
              )}
              {user ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
                >
                  לוח בקרה
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold"
                >
                  התחבר
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main>{children}</main>
    </div>
  )
}
