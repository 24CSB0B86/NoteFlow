-- ============================================================
-- NoteFlow Storage RLS Fix
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Drop the old restrictive upload policy for resources bucket
DROP POLICY IF EXISTS "Authenticated users can upload resources" ON storage.objects;

-- Create new policy that allows BOTH authenticated users AND service_role
CREATE POLICY "Allow uploads to resources bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'resources'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Also fix the read policy to allow service_role reads (for signed URLs)
DROP POLICY IF EXISTS "Authenticated users can read resources" ON storage.objects;

CREATE POLICY "Allow reads from resources bucket"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'resources'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Fix update policy for resources (needed for upsert)
DROP POLICY IF EXISTS "Allow updates to resources bucket" ON storage.objects;

CREATE POLICY "Allow updates to resources bucket"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'resources'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Fix delete policy
DROP POLICY IF EXISTS "Service role can delete resources" ON storage.objects;

CREATE POLICY "Allow deletes from resources bucket"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'resources'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Fix thumbnails bucket (service_role needs full access for background processing)
DROP POLICY IF EXISTS "Service role can manage thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read thumbnails" ON storage.objects;

CREATE POLICY "Allow all on thumbnails bucket"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'thumbnails'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  )
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );

-- Fix previews bucket
DROP POLICY IF EXISTS "Service role can manage previews" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read previews" ON storage.objects;

CREATE POLICY "Allow all on previews bucket"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'previews'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  )
  WITH CHECK (
    bucket_id = 'previews'
    AND (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  );
