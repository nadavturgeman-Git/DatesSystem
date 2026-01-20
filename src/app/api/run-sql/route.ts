import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Read SQL file
    const sqlFilePath = path.join(process.cwd(), 'fix-rls-policies.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    // Split into individual statements
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--') && s.length > 0 && !s.startsWith('SELECT'));

    const results = [];
    const errors = [];

    // Execute each statement
    for (const statement of statements) {
      if (statement.length === 0) continue;

      try {
        // Use RPC to execute SQL (if available) or direct query
        // Since we can't execute DDL via REST API, we'll need to use the service role
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });

        if (error) {
          // Try direct execution via REST API (won't work for DDL)
          // Actually, we need to use the PostgREST API differently
          // For now, return instructions
          errors.push({ statement: statement.substring(0, 50), error: error.message });
        } else {
          results.push({ statement: statement.substring(0, 50), success: true });
        }
      } catch (err: any) {
        errors.push({ statement: statement.substring(0, 50), error: err.message });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          message: 'Cannot execute DDL via REST API',
          instructions: 'Please run the SQL manually in Supabase Dashboard',
          url: 'https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/sql',
          sql: sql,
          errors: errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      executed: results.length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        message: 'Cannot execute DDL statements via REST API. Please use Supabase Dashboard SQL Editor.',
        url: 'https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/sql',
      },
      { status: 500 }
    );
  }
}
