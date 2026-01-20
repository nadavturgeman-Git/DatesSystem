import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription || error)}`, requestUrl.origin)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', requestUrl.origin));
  }

  try {
    const supabase = await createClient();

    // Exchange the code for a session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
      );
    }

    // Get the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Error getting user:', userError);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(userError?.message || 'user_not_found')}`, requestUrl.origin)
      );
    }

    // Check if profile exists
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    // If no profile exists, create one (for Google OAuth users)
    if (!existingProfile && !profileCheckError) {
      const fullName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.email?.split('@')[0] || 
                       'User';

      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email!,
        full_name: fullName,
        phone: user.user_metadata?.phone || null,
        role: 'distributor', // Default role
      });

      if (insertError) {
        console.error('Error creating profile:', insertError);
        // Don't redirect to error - user is authenticated, just profile creation failed
        // They can update their profile later
      }
    }

    // Redirect to dashboard after successful login
    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
  } catch (err: any) {
    console.error('Unexpected error in callback:', err);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(err.message || 'unexpected_error')}`, requestUrl.origin)
    );
  }
}
