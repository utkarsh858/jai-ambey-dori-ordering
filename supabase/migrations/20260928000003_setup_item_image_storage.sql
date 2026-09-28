-- Setup for item image storage
-- This migration sets up the storage bucket for item images
-- Run this, then go to Supabase Storage and create the "item-images" bucket if it doesn't exist

-- The bucket should be:
-- Name: item-images
-- Public: Yes (or configure public access via RLS)
-- RLS Policies needed:
-- 1. Public select: allow anyone to view images
-- 2. Admin upload/update/delete: allow only admins

-- For now, we'll document the manual steps:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: "item-images"
-- 4. Uncheck "Private bucket" to make it public
-- 5. Click "Create bucket"
-- 6. Upload images will now work automatically

-- NOTE: In production, consider:
-- - Setting up signed URLs for private buckets
-- - Adding lifecycle policies to delete old images
-- - Configuring CDN for better performance
