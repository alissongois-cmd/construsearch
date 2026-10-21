-- Add product images and configure a public Supabase Storage bucket.

alter table public.materiais
  add column if not exists imagem_url text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'materiais-imagens',
  'materiais-imagens',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Public downloads. The bucket is public, and this policy also permits listing
-- and reading objects through the authenticated/anonymous Storage API.
drop policy if exists "Public can read material images" on storage.objects;
create policy "Public can read material images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'materiais-imagens');

-- Every uploaded file is stored under a folder named with the authenticated
-- user's UUID. A user can only write inside that own folder.
drop policy if exists "Authenticated users can upload material images" on storage.objects;
create policy "Authenticated users can upload material images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'materiais-imagens'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Authenticated users can update own material images" on storage.objects;
create policy "Authenticated users can update own material images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'materiais-imagens'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'materiais-imagens'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "Authenticated users can delete own material images" on storage.objects;
create policy "Authenticated users can delete own material images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'materiais-imagens'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
