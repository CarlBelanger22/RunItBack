-- RunItBack — Supabase Storage for team/tournament logos (CI-1)
-- Paste into Supabase SQL Editor if npm run db:migrate:006 cannot use psql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-assets',
  'team-assets',
  true,
  524288,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "team_assets_public_read" on storage.objects;
create policy "team_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'team-assets');

drop policy if exists "team_assets_dev_insert" on storage.objects;
create policy "team_assets_dev_insert"
  on storage.objects for insert
  with check (bucket_id = 'team-assets');

drop policy if exists "team_assets_dev_update" on storage.objects;
create policy "team_assets_dev_update"
  on storage.objects for update
  using (bucket_id = 'team-assets');

drop policy if exists "team_assets_dev_delete" on storage.objects;
create policy "team_assets_dev_delete"
  on storage.objects for delete
  using (bucket_id = 'team-assets');
