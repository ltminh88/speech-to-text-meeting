-- Meet Plus — transcript storage (Phase 2). Additive migration.
-- Text + translations stored as a single AES-256-GCM ciphertext (per-session key).
-- Audio is NEVER stored. In no_record sessions, no row is written at all.

create table public.transcript_segments (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.sessions (id) on delete cascade,
  participant_id  uuid references public.session_participants (id) on delete set null,
  speaker_id      text,
  speaker_name    text,
  sequence_number bigint not null,
  text_encrypted  text not null,          -- AES-256-GCM of JSON {text, translations}
  lang            text,
  is_final        boolean not null default true,
  created_at      timestamptz not null default now()
);
create index transcript_segments_session_id_idx on public.transcript_segments (session_id);
create unique index transcript_segments_session_seq_idx
  on public.transcript_segments (session_id, sequence_number);

alter table public.transcript_segments enable row level security;

-- Members read their session's transcript; writes happen server-side via service role.
create policy transcript_select_member on public.transcript_segments
  for select using (public.is_session_member(session_id));
