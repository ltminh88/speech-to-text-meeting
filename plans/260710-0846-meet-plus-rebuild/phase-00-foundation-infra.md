# Phase 0 — Foundation & Infra

**Priority:** P1 · **Status:** done (code+build; live smoke deferred) · **Depends:** none (blocks all) · **Effort:** 3-5d

## Context Links
- Strategy report §4 (schema), §3 (Centrifugo): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Arch spec (tables/RPC list): `/Users/minhlt/plans/reports/reverse-260710-0757-meet-plus-architecture.md`
- Mirror channel helpers: `_reverse/mirror/_app/immutable/chunks/Cx0uHDNg.js`
- Mirror schema evidence: `_reverse/mirror/_app/immutable/nodes/46.C1_EoNGo.js` (lines ~3306-3348)

## Overview
Stand up the skeleton every later phase builds on: SvelteKit app, Supabase project (Postgres schema + RLS + Google OAuth), Centrifugo self-host (Docker) + token endpoints. No product feature yet — just the rails.

## Key Insights
- Build **Centrifugo-only**; ignore legacy Supabase Realtime broadcast path (migration artefact).
- Two Centrifugo clients in original app: session-scoped (`/api/centrifugo-token`) + user-scoped (`/api/centrifugo-user-token`). Token endpoints MUST reject cross-origin (same-origin/relative only).
- RPC (`approve_join_request` etc.) → `SECURITY DEFINER`, outside exposed `public` REST, called via `supabase.rpc()`.
- Schema columns are the load-bearing artefact — get them right now to avoid churn later.

## Requirements
Functional: `npm run dev` serves SvelteKit; Supabase migrations apply cleanly; Google login round-trips a session cookie; Centrifugo container accepts a JWT minted by the token endpoint and delivers a test publish.
Non-functional: all secrets via env; migrations reproducible (SQL files in `supabase/migrations/`); Centrifugo config in `docker-compose.yml` (dev) reproducible.

## Architecture / Data flow
```
Browser ──login──► SvelteKit /auth/login ──► Supabase Auth (Google OAuth) ──► cookie session
Browser ──GET /api/centrifugo-token (cookie)──► SvelteKit route ──HMAC sign JWT{sub,exp}──► client
Browser ──wss /realtime──► Centrifugo (validates JWT via shared hmac_secret) ──► subscribe channels
```
Data in: Google identity. Transforms: → Supabase user row + JWT. Out: session cookie, Centrifugo token.

## Related Code Files
Create:
- `package.json`, `svelte.config.js`, `vite.config.ts`, `tailwind.config.ts`, `.env.example`
- `src/lib/server/supabase.ts` (admin + SSR client factory), `src/lib/supabase.ts` (browser client)
- `src/hooks.server.ts` (Supabase SSR session → `event.locals`)
- `src/routes/auth/login/+server.ts`, `src/routes/auth/logout/+server.ts`, `src/routes/auth/callback/+server.ts`
- `src/routes/api/centrifugo-token/+server.ts`, `src/routes/api/centrifugo-user-token/+server.ts`
- `src/lib/realtime/channels.ts` (port of `chunks/Cx0uHDNg.js` channel helpers)
- `supabase/migrations/0001_core_schema.sql`, `supabase/migrations/0002_rls_policies.sql`, `supabase/migrations/0003_rpc.sql`
- `docker-compose.yml` (Centrifugo), `centrifugo/config.json`
Read for reference: `chunks/Cx0uHDNg.js`, `nodes/46.C1_EoNGo.js`.

## Implementation Steps
1. Scaffold SvelteKit (`npm create svelte@latest`), add Tailwind, `@supabase/ssr`, `centrifuge` (JS SDK), `jsonwebtoken`.
2. Write `0001_core_schema.sql` — tables: `users, sessions, session_participants, mic_active_segments, session_tags, session_tag_assignments, session_bookmarks, context_sets, calendar_sync_connections, feedbacks, api_keys` (columns per strategy §4). Index `user_id`, `session_id` FKs.
3. Write `0002_rls_policies.sql` — enable RLS all tables; scope by `auth.uid()` and `session_id ∈ (SELECT session_id FROM session_participants WHERE user_id = auth.uid())`. Avoid recursive policy (use SECURITY DEFINER helper for membership check).
4. Write `0003_rpc.sql` — `request_to_join, approve_join_request, reject_join_request, invite_participant` as `SECURITY DEFINER`.
5. Configure Supabase Google OAuth (scope `openid email profile`). Implement `/auth/*` + `hooks.server.ts` session plumbing.
6. Centrifugo: `docker-compose.yml` + `config.json` (hmac_secret from env, namespace `captions/settings/participants/...`, allowed_origins). Implement both token endpoints (same-origin guard, sign `{sub, exp}` + optional `channels`).
7. Port channel-name helpers to `src/lib/realtime/channels.ts`.
8. Smoke test: login → mint token → subscribe test channel → publish via `/api/broadcast` stub → receive in browser console.

## Todo
- [ ] SvelteKit scaffold + Tailwind + deps
- [ ] `0001_core_schema.sql`
- [ ] `0002_rls_policies.sql`
- [ ] `0003_rpc.sql`
- [ ] Google OAuth + `/auth/*` + hooks.server.ts
- [ ] Centrifugo docker-compose + config
- [ ] Both token endpoints (same-origin guard)
- [ ] channels.ts port
- [ ] End-to-end smoke test

## Success Criteria (measurable)
- `supabase db reset` applies 3 migrations with 0 errors; `\d sessions` shows all columns.
- Login redirects and sets a valid cookie; `locals.user` populated on next request.
- Browser subscribes `test:ping`, receives a publish within <500ms.
- Token endpoint returns 403 for cross-origin `Referer`.

## Test Matrix
- Unit: JWT signing (exp, sub), same-origin guard.
- Integration: migration apply + RLS deny (user A cannot select user B's session row).
- E2E: login → token → subscribe → publish round-trip.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| RLS recursion on membership subquery | Med×High | SECURITY DEFINER `is_session_member()` helper; test deny/allow both |
| Centrifugo JWT/secret mismatch | Med×High | Single source env `CENTRIFUGO_HMAC_SECRET`; smoke test in step 8 |
| Schema drift vs later phases | Med×Med | Freeze columns from strategy §4 now; additive migrations only |

## Rollback
Migrations are numbered + additive → `supabase db reset` to prior migration. Centrifugo is a container → `docker compose down`. No user data yet, zero blast radius.

## Security
Secrets only in `.env` (gitignored). Service-role key server-only. Token endpoints same-origin. RLS on before any data written.

## Next Steps
Unblocks Phase 1 (auth+session) and Phase 2 (pipeline). Phase 7 (calendar) reuses OAuth plumbing.
