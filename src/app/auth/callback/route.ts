import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code);

    // Get the user
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      // If no profile exists, create one (for Google OAuth users)
      if (!existingProfile) {
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';

        await supabase.from('profiles').insert({
          id: user.id,
          email: user.email!,
          full_name: fullName,
          phone: user.user_metadata?.phone || null,
          role: 'distributor', // Default role
        });
      }
    }
  }

  // Redirect to dashboard after successful login
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
}
