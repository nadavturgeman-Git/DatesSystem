import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get role from query params (default to 'distributor')
    const { searchParams } = new URL(request.url);
    const role = (searchParams.get('role') || 'distributor') as 'admin' | 'team_leader' | 'distributor';
    const fixed = searchParams.get('fixed') === 'true';

    // Create a test user
    const roleName = role === 'admin' ? 'מנהל' : role === 'team_leader' ? 'ראש צוות' : 'מפיץ';
    
    // Use fixed credentials for admin if requested
    let testEmail: string;
    let testPassword: string;
    let testName: string;
    
    if (fixed && role === 'admin') {
      testEmail = 'admin@dates.com';
      testPassword = 'admin123456';
      testName = 'מנהל מערכת';
    } else {
      testEmail = `${role}-${Date.now()}@example.com`;
      testPassword = 'test123456';
      testName = `משתמש בדיקה - ${roleName}`;
    }

    // Check if user already exists (for fixed admin)
    let authData: any = null;
    if (fixed && role === 'admin') {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users.find((u) => u.email === testEmail);
      
      if (existingUser) {
        // Update existing user
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            password: testPassword,
            user_metadata: {
              full_name: testName,
            },
          }
        );
        
        if (updateError) {
          return NextResponse.json(
            { error: `Failed to update user: ${updateError.message}` },
            { status: 500 }
          );
        }
        
        authData = { user: updatedUser.user };
        
        // Update profile
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            full_name: testName,
            role: role,
          })
          .eq('id', existingUser.id);
          
        if (profileUpdateError) {
          return NextResponse.json(
            { error: `Failed to update profile: ${profileUpdateError.message}` },
            { status: 500 }
          );
        }
      }
    }
    
    // Create new user if not exists
    if (!authData) {
      const { data: newAuthData, error: authError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: testName,
        },
      });

      if (authError || !newAuthData.user) {
        return NextResponse.json(
          { error: authError?.message || 'Failed to create user' },
          { status: 500 }
        );
      }

      authData = newAuthData;
      
      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email: testEmail,
        full_name: testName,
        role: role,
      });

      if (profileError) {
        // If profile creation fails, delete the auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return NextResponse.json(
          { error: `Profile creation failed: ${profileError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ משתמש בדיקה (${roleName}) נוצר בהצלחה!`,
      credentials: {
        email: testEmail,
        password: testPassword,
        role: role,
        roleName: roleName,
        loginUrl: 'http://localhost:3005/login',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
