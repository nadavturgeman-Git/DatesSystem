-- Supabase Storage Bucket Configuration for Fault Reports
-- This SQL should be executed in Supabase SQL Editor to create the bucket and policies

-- ============================================================================
-- STORAGE BUCKET CREATION
-- ============================================================================

-- Create the fault-reports bucket (public for read access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fault-reports',
  'fault-reports',
  true,  -- Public bucket for read access
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png']  -- Only allow JPEG and PNG images
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png'];

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy: Anyone can upload images (for fault reporting by customers)
-- File path format: {orderId}_{timestamp}_{index}.{ext}
CREATE POLICY "Anyone can upload fault report images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'fault-reports'
  AND (storage.foldername(name))[1] IS NOT NULL
);

-- Policy: Anyone can view fault report images (public bucket)
CREATE POLICY "Anyone can view fault report images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'fault-reports');

-- Policy: Only admins and team leaders can delete fault report images
CREATE POLICY "Admins and team leaders can delete fault report images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'fault-reports'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'team_leader')
  )
);

-- Policy: Only admins and team leaders can update fault report images
CREATE POLICY "Admins and team leaders can update fault report images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'fault-reports'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'team_leader')
  )
);

-- ============================================================================
-- NOTES
-- ============================================================================
--
-- To execute this in Supabase:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run"
--
-- The bucket will be available at:
-- {SUPABASE_URL}/storage/v1/object/public/fault-reports/{filename}
--
-- Upload endpoint:
-- {SUPABASE_URL}/storage/v1/object/fault-reports/{filename}
--
-- Filename convention: {orderId}_{timestamp}_{index}.{ext}
-- Example: 550e8400-e29b-41d4-a716-446655440000_1705678900_0.jpg
