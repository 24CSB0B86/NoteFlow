-- Run this in your Supabase Dashboard -> SQL Editor
-- This sets up the storage buckets and RLS policies for NoteFlow file management

-- 1. Create buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('resources', 'resources', false, 104857600, array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4']),
  ('thumbnails', 'thumbnails', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('previews', 'previews', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- 2. Set up RLS for resources bucket
create policy "Authenticated users can upload resources" on storage.objects
  for insert with check ( bucket_id = 'resources' and auth.role() = 'authenticated' );

create policy "Authenticated users can read resources" on storage.objects
  for select using ( bucket_id = 'resources' and auth.role() = 'authenticated' );

create policy "Service role can delete resources" on storage.objects
  for delete using ( bucket_id = 'resources' and auth.role() = 'service_role' );

-- 3. Set up RLS for thumbnails bucket
create policy "Authenticated users can read thumbnails" on storage.objects
  for select using ( bucket_id = 'thumbnails' and auth.role() = 'authenticated' );

create policy "Service role can manage thumbnails" on storage.objects
  for all using ( bucket_id = 'thumbnails' and auth.role() = 'service_role' );

-- 4. Set up RLS for previews bucket
create policy "Authenticated users can read previews" on storage.objects
  for select using ( bucket_id = 'previews' and auth.role() = 'authenticated' );

create policy "Service role can manage previews" on storage.objects
  for all using ( bucket_id = 'previews' and auth.role() = 'service_role' );
