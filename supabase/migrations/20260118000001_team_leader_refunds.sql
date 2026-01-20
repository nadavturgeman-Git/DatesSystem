-- Migration: Allow Team Leaders to Manage Returns/Refunds
-- Date: 2026-01-18
-- Purpose: Grant team_leader role permission to approve refunds and manage returns
-- PRD Requirement: Team Leaders should have authorization to perform order cancellations and refunds

-- ============================================================================
-- UPDATE RLS POLICY: Returns Table
-- ============================================================================

-- Drop existing admin-only policy
DROP POLICY IF EXISTS "Admins can manage returns" ON returns;

-- Create new policy allowing both admin and team_leader roles
CREATE POLICY "Admins and Team Leaders can manage returns" ON returns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'team_leader')
        )
    );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- List all policies on returns table to verify
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'returns'
ORDER BY policyname;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Admins and Team Leaders can manage returns" ON returns IS
'Allows both admin and team_leader roles to approve refunds, manage returns, and handle damage reports. This enables regional team leaders to handle customer service issues within their territory.';
