'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface TopBarProps {
  user: User
  profile: any
}

export default function TopBar({ user, profile }: TopBarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    if (confirm('האם אתה בטוח שברצונך להתנתק?')) {
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Right side - User info */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900">
              {profile?.full_name || user.email || 'ללא שם'}
            </p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
          >
            התנתק
          </button>
        </div>

        {/* Left side - Quick actions */}
        <div className="flex items-center gap-2">
          <a
            href="/catalog"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold flex items-center gap-2"
          >
            <span>🛒</span>
            <span className="hidden sm:inline">קטלוג</span>
          </a>
        </div>
      </div>
    </header>
  )
}
