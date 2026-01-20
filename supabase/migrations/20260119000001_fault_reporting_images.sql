-- Add image_urls column to returns table for fault reporting photos
-- Migration: 20260119000001_fault_reporting_images

-- Add image_urls column to store array of photo URLs from Supabase Storage
ALTER TABLE returns
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN returns.image_urls IS 'Array of Supabase Storage URLs for fault report photos (max 5 photos per report)';
