'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface DashboardNavProps {
  user: User;
  profile: any;
}

export default function DashboardNav({ user, profile }: DashboardNavProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title */}
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="text-2xl font-bold text-emerald-600">🌴</div>
            <span className="text-xl font-bold text-gray-900">מערכת ניהול תמרים</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6 space-x-reverse">
            <Link
              href="/dashboard"
              className="text-gray-700 hover:text-emerald-600 font-medium transition"
            >
              ראשי
            </Link>
            <Link
              href="/orders/new"
              className="text-emerald-600 hover:text-emerald-700 font-semibold transition"
            >
              + הזמנה חדשה
            </Link>
            {profile?.role === 'admin' && (
              <>
                <Link
                  href="/dashboard/inventory"
                  className="text-gray-700 hover:text-emerald-600 font-medium transition"
                >
                  מלאי
                </Link>
                <Link
                  href="/dashboard/orders"
                  className="text-gray-700 hover:text-emerald-600 font-medium transition"
                >
                  הזמנות
                </Link>
                <Link
                  href="/dashboard/distributors"
                  className="text-gray-700 hover:text-emerald-600 font-medium transition"
                >
                  מפיצים
                </Link>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4 space-x-reverse">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              התנתק
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
