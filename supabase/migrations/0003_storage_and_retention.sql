-- Pokora AI - private storage bucket and guest retention
--
-- The bucket is private: no anonymous or authenticated role gets a storage
-- policy, so objects are only reachable through signed URLs minted by the
-- server after it has authorised the request.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pokora-uploads',
  'pokora-uploads',
  false,
  10485760, -- 10 MB, mirrors MAX_UPLOAD_BYTES
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Guest retention
-- ---------------------------------------------------------------------------

-- Deletes expired guest analyses. Cascades remove images, detected cards,
-- candidates and prices. Storage objects are removed by the application's
-- cleanup job, which reads storage_path before the row disappears.
create or replace function public.delete_expired_guest_analyses()
returns table (deleted_session_id uuid, storage_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with expired as (
    select s.id
    from public.analysis_sessions s
    where s.user_id is null
      and s.expires_at is not null
      and s.expires_at < now()
    limit 500
  ),
  paths as (
    select i.analysis_session_id, i.storage_path
    from public.analysis_images i
    join expired e on e.id = i.analysis_session_id
  ),
  removed as (
    delete from public.analysis_sessions s
    using expired e
    where s.id = e.id
    returning s.id
  )
  select r.id, p.storage_path
  from removed r
  left join paths p on p.analysis_session_id = r.id;
end;
$$;

revoke all on function public.delete_expired_guest_analyses() from public;

-- Schedule with pg_cron if the extension is available on your project:
--   select cron.schedule(
--     'pokora-ai-guest-cleanup', '17 * * * *',
--     $$select public.delete_expired_guest_analyses();$$
--   );
-- Otherwise call POST /api/maintenance/cleanup from an external scheduler.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger analysis_sessions_touch_updated_at
  before update on public.analysis_sessions
  for each row execute function public.touch_updated_at();

create trigger detected_cards_touch_updated_at
  before update on public.detected_cards
  for each row execute function public.touch_updated_at();

create trigger catalog_cards_touch_updated_at
  before update on public.catalog_cards
  for each row execute function public.touch_updated_at();

create trigger collection_items_touch_updated_at
  before update on public.collection_items
  for each row execute function public.touch_updated_at();
