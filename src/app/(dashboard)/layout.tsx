import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import Breadcrumbs from '@/components/layout/Breadcrumbs';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile with role - use service role to bypass RLS if needed
  let profile = null;
  let profileError = null;
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    profile = data;
    profileError = error;
  } catch (err: any) {
    profileError = err;
  }
  
  // If profile not found, create a basic one from user metadata
  if (!profile && !profileError) {
    profile = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'משתמש',
      role: 'distributor' as const,
    };
  }

  // Debug: Log profile loading (only in development)
  if (process.env.NODE_ENV === 'development') {
    if (profileError) {
      console.error('[Dashboard Layout] Profile loading error:', profileError);
    }
    if (!profile) {
      console.warn('[Dashboard Layout] Profile is null for user:', user.id, user.email);
    } else {
      console.log('[Dashboard Layout] Profile loaded:', { 
        email: profile.email, 
        role: profile.role, 
        full_name: profile.full_name,
        isAdmin: profile.role === 'admin'
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar - Fixed on desktop, overlay on mobile */}
      <Sidebar user={user} profile={profile} />
      
      {/* Main content area */}
      <div className="lg:mr-64">
        {/* Top bar */}
        <TopBar user={user} profile={profile} />
        
        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
