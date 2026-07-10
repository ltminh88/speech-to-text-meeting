-- Meet Plus — Row Level Security (Phase 0)
-- Membership check via SECURITY DEFINER helper to avoid recursive policy evaluation.

create or replace function public.is_session_member(sid uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.session_participants p
    where p.session_id = sid
      and p.user_id = auth.uid()
      and p.status in ('approved', 'active')
  ) or exists (
    select 1 from public.sessions s
    where s.id = sid and s.host_id = auth.uid()
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.mic_active_segments enable row level security;
alter table public.context_sets enable row level security;
alter table public.session_tags enable row level security;
alter table public.session_tag_assignments enable row level security;
alter table public.session_bookmarks enable row level security;
alter table public.calendar_sync_connections enable row level security;
alter table public.feedbacks enable row level security;
alter table public.api_keys enable row level security;

-- users: read own row (or admin); update own row.
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_admin());
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- sessions: host or member can read; host writes.
create policy sessions_select_member on public.sessions
  for select using (host_id = auth.uid() or public.is_session_member(id) or public.is_admin());
create policy sessions_insert_host on public.sessions
  for insert with check (host_id = auth.uid());
create policy sessions_update_host on public.sessions
  for update using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy sessions_delete_host on public.sessions
  for delete using (host_id = auth.uid());

-- participants: members read; a user may insert their own join request; host manages via RPC.
create policy participants_select_member on public.session_participants
  for select using (public.is_session_member(session_id) or user_id = auth.uid());
create policy participants_insert_self on public.session_participants
  for insert with check (user_id = auth.uid());

-- mic segments: members read; server (service role) writes.
create policy mic_segments_select_member on public.mic_active_segments
  for select using (public.is_session_member(session_id));

-- context sets: owner only.
create policy context_sets_all_owner on public.context_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tags: owner only.
create policy tags_all_owner on public.session_tags
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- tag assignments: only on sessions you host.
create policy tag_assign_owner on public.session_tag_assignments
  for all using (exists (select 1 from public.sessions s where s.id = session_id and s.host_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.host_id = auth.uid()));

-- bookmarks: owner within a session they belong to.
create policy bookmarks_all_owner on public.session_bookmarks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_session_member(session_id));

-- calendar connections: owner only.
create policy calendar_all_owner on public.calendar_sync_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- feedback: insert own; admin reads all.
create policy feedbacks_insert_self on public.feedbacks
  for insert with check (user_id = auth.uid());
create policy feedbacks_select_admin on public.feedbacks
  for select using (user_id = auth.uid() or public.is_admin());

-- api keys: owner reads metadata / revokes; secret hash created server-side.
create policy api_keys_select_owner on public.api_keys
  for select using (user_id = auth.uid());
create policy api_keys_delete_owner on public.api_keys
  for delete using (user_id = auth.uid());
