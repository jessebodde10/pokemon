-- Pokora - row level security
--
-- The application server uses the service-role key and performs its own
-- authorisation in `src/services/analysis-access.ts`. These policies are
-- defence in depth for any connection that arrives with an end-user JWT:
-- a signed-in user may only ever reach their own rows, and guest analyses
-- are not reachable through RLS at all (they are only served by the server
-- after it has verified the httpOnly guest token).

alter table public.profiles enable row level security;
alter table public.analysis_sessions enable row level security;
alter table public.analysis_images enable row level security;
alter table public.detected_cards enable row level security;
alter table public.card_match_candidates enable row level security;
alter table public.catalog_cards enable row level security;
alter table public.price_estimates enable row level security;
alter table public.collection_items enable row level security;
alter table public.audit_events enable row level security;

-- --- profiles --------------------------------------------------------------

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- --- analysis_sessions -----------------------------------------------------

create policy "sessions_select_own" on public.analysis_sessions
  for select using (auth.uid() = user_id);

create policy "sessions_insert_own" on public.analysis_sessions
  for insert with check (auth.uid() = user_id);

create policy "sessions_update_own" on public.analysis_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions_delete_own" on public.analysis_sessions
  for delete using (auth.uid() = user_id);

-- --- helper ----------------------------------------------------------------

-- Returns true when the current JWT owns the given session. Marked stable and
-- security definer so the policies below stay short and index-friendly.
create or replace function public.owns_analysis_session(session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.analysis_sessions s
    where s.id = session_id
      and s.user_id = auth.uid()
  );
$$;

revoke all on function public.owns_analysis_session(uuid) from public;
grant execute on function public.owns_analysis_session(uuid) to authenticated;

-- --- analysis_images -------------------------------------------------------

create policy "images_select_own" on public.analysis_images
  for select using (public.owns_analysis_session(analysis_session_id));

create policy "images_write_own" on public.analysis_images
  for all
  using (public.owns_analysis_session(analysis_session_id))
  with check (public.owns_analysis_session(analysis_session_id));

-- --- detected_cards --------------------------------------------------------

create policy "detected_cards_select_own" on public.detected_cards
  for select using (public.owns_analysis_session(analysis_session_id));

create policy "detected_cards_write_own" on public.detected_cards
  for all
  using (public.owns_analysis_session(analysis_session_id))
  with check (public.owns_analysis_session(analysis_session_id));

-- --- card_match_candidates -------------------------------------------------

create policy "candidates_select_own" on public.card_match_candidates
  for select using (
    exists (
      select 1 from public.detected_cards d
      where d.id = detected_card_id
        and public.owns_analysis_session(d.analysis_session_id)
    )
  );

-- --- price_estimates -------------------------------------------------------

create policy "prices_select_own" on public.price_estimates
  for select using (
    exists (
      select 1 from public.detected_cards d
      where d.id = detected_card_id
        and public.owns_analysis_session(d.analysis_session_id)
    )
  );

-- --- catalog_cards ---------------------------------------------------------

-- Reference data: readable by any authenticated user, writable only by the
-- service role (which bypasses RLS).
create policy "catalog_select_authenticated" on public.catalog_cards
  for select to authenticated using (true);

-- --- collection_items ------------------------------------------------------

create policy "collection_select_own" on public.collection_items
  for select using (auth.uid() = user_id);

create policy "collection_insert_own" on public.collection_items
  for insert with check (auth.uid() = user_id);

create policy "collection_update_own" on public.collection_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "collection_delete_own" on public.collection_items
  for delete using (auth.uid() = user_id);

-- --- audit_events ----------------------------------------------------------

-- Read-only for the owner; writes go through the service role so a client
-- cannot forge an audit trail.
create policy "audit_select_own" on public.audit_events
  for select using (auth.uid() = user_id);
