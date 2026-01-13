-- Fix Profile Creation RLS Policy
-- Run this in Supabase SQL Editor to fix signup profile creation issue
-- URL: https://supabase.com/dashboard/project/cikrfepaurkbrkmmgnnm/sql
-- Date: 2026-01-13

-- This policy allows authenticated users to create their own profile during signup
CREATE POLICY "Allow signup to create own profile" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow signup to create own profile';
