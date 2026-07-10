-- Meet Plus — core schema (Phase 0)
-- Columns frozen from reverse-engineering strategy §4. Additive migrations only afterwards.

create extension if not exists "pgcrypto";

-- Profile row mirroring auth.users (id == auth.uid()).
create table public.users (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text unique not null,
  name          text,
  avatar_url    text,
  role          text not null default 'user'   check (role in ('admin', 'user')),
  status        text not null default 'active'  check (status in ('active', 'suspended')),
  premium       boolean not null default false,
  quota_used    integer not null default 0,
  quota_reset_at timestamptz,
  created_at    timestamptz not null default now()
);

-- A live/finished meeting. Translation config lives here (observed columns).
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  host_id       uuid not null references public.users (id) on delete cascade,
  status        text not null default 'active' check (status in ('active', 'ended')),
  mode          text not null default 'none'   check (mode in ('none', 'one_way', 'two_way')),
  no_translation boolean not null default false,
  no_record     boolean not null default false,
  source_language text,
  target_language text,
  language_a    text,
  language_b    text,
  title_encrypted text,                 -- AES-256-GCM ciphertext
  encryption_key_ref text,              -- per-session key reference (HKDF salt/id)
  active_recording_source text,
  active_recording_participant_id uuid,
  active_recording_disconnected_at timestamptz,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  created_at    timestamptz not null default now()
);
create index sessions_host_id_idx on public.sessions (host_id);
create index sessions_status_idx on public.sessions (status);

-- Membership + join-request state machine.
create table public.session_participants (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  user_id       uuid references public.users (id) on delete cascade,   -- null for guests
  guest_name    text,
  role          text not null default 'participant' check (role in ('host', 'participant')),
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'active', 'left', 'rejected')),
  muted         boolean not null default false,
  joined_at     timestamptz,
  created_at    timestamptz not null default now(),
  unique (session_id, user_id)
);
create index session_participants_session_id_idx on public.session_participants (session_id);
create index session_participants_user_id_idx on public.session_participants (user_id);

-- Who is speaking, when (speaking-time analytics).
create table public.mic_active_segments (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  participant_id uuid references public.session_participants (id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index mic_active_segments_session_id_idx on public.mic_active_segments (session_id);

-- Custom vocabulary sent to Soniox as context terms.
create table public.context_sets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  name          text not null,
  terms         text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index context_sets_user_id_idx on public.context_sets (user_id);

-- Per-user tags, many-to-many onto sessions.
create table public.session_tags (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  name          text not null,
  color         text,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

create table public.session_tag_assignments (
  session_id    uuid not null references public.sessions (id) on delete cascade,
  tag_id        uuid not null references public.session_tags (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (session_id, tag_id)
);

-- Bookmark a moment in a session transcript.
create table public.session_bookmarks (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  user_id       uuid not null references public.users (id) on delete cascade,
  label         text,
  timestamp_ms  bigint,
  created_at    timestamptz not null default now()
);
create index session_bookmarks_session_id_idx on public.session_bookmarks (session_id);

-- Google Calendar OAuth + auto-create-session rules.
create table public.calendar_sync_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  provider      text not null default 'google',
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  rule          jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- User feedback (+ storage bucket feedback-images, created out-of-band).
create table public.feedbacks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.users (id) on delete set null,
  content       text not null,
  image_paths   text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Personal access tokens (read-only MCP-style integration). Store hash only.
create table public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  key_hash      text not null unique,
  name          text not null,
  last_used_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index api_keys_user_id_idx on public.api_keys (user_id);

-- Auto-provision a profile row when a new auth user signs up (Google OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
