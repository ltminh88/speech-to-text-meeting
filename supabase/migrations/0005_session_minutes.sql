-- Meet Plus — cached meeting minutes (Phase 3). Additive migration.
-- Writes happen server-side (service role) after a host-only guard in the API
-- route, mirroring the transcript_segments write pattern; RLS covers reads.

create table public.session_minutes (
  session_id    uuid primary key references public.sessions (id) on delete cascade,
  content       jsonb not null,
  generated_at  timestamptz not null default now()
);

alter table public.session_minutes enable row level security;

create policy session_minutes_select_member on public.session_minutes
  for select using (public.is_session_member(session_id));
