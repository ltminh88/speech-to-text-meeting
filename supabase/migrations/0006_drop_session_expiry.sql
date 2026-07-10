-- Reverts 0006_session_expiry.sql (duration-limit feature was scrapped in
-- favor of unlimited sessions that can be reopened after ending).

alter table public.sessions drop column if exists expires_at;
