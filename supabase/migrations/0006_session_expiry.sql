-- Meet Plus — optional session duration limit (Phase 1 extension). Additive.
-- No background job: expiry is checked lazily whenever a session is accessed
-- (GET, join, or realtime-server audio ingest) and flips status to 'ended'.

alter table public.sessions add column expires_at timestamptz;
