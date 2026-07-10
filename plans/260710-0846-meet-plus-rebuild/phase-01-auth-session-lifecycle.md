# Phase 1 — Google Auth + Session lifecycle (MVP)

**Priority:** P1 · **Status:** done (code+build+unit tests; live E2E deferred) · **Depends:** Phase 0 · **Effort:** 3-4d

## Context Links
- Strategy §4 (sessions/participants columns), §2 (translation modes): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Routes list: arch spec lines 33-38
- Mirror: `nodes/46.C1_EoNGo.js` (session view + create/settings state), `login.html`, `dashboard.html`

## Overview
User can log in with Google, create a session (choosing translation mode + languages + record/no-record), and join an existing session (guest or authed). This is the state layer the pipeline (Phase 2) rides on. Keep join flow minimal here (direct join by link/code); full join-request approval flow deferred to Phase 4.

## Key Insights
- `sessions` translation config columns: `mode` (None|One-Way|Two-Way), `no_translation`, `source_language`, `target_language`, `language_a`, `language_b`, `no_record`.
- `title_encrypted` (AES-256-GCM) — title stored encrypted; encrypt/decrypt lives server-side (key mgmt = Phase 2 concern, stub here with per-session key ref).
- `session_participants.status`: pending|approved|active|left; `role`: host|participant.
- Guest join allowed → `user_id` nullable on participant.

## Requirements
Functional: create session persists row + host participant; join adds participant + returns session config; leave/end updates status; only host can end.
Non-functional: session config read must be RLS-safe; create <300ms p95.

## Architecture / Data flow
```
POST /api/sessions {mode,langs,no_record} ─► insert sessions + participant(host) ─► {sessionId}
POST /api/sessions/[id]/join ─► insert participant(status=active) ─► {session config, participantId}
POST /api/sessions/[id]/end (host) ─► sessions.status=ended, started_at/ended bookkeeping
GET  /api/sessions/[id] ─► RLS-scoped session + participants (for UI hydration)
```
In: create form / join link. Transform: rows + Centrifugo user token. Out: session config consumed by Phase 2 pipeline.

## Related Code Files
Create:
- `src/routes/sessions/new/+page.svelte` (+ `+page.server.ts` form action)
- `src/routes/sessions/join/+page.svelte`, `src/routes/session/[id]/+page.svelte` (shell; captions added Phase 2)
- `src/routes/api/sessions/+server.ts` (POST create, GET list-mine)
- `src/routes/api/sessions/[id]/+server.ts` (GET/PATCH/end)
- `src/routes/api/sessions/[id]/join/+server.ts`
- `src/lib/server/crypto.ts` (AES-256-GCM encrypt/decrypt title — key ref stub)
- `src/lib/session/session-config.ts` (mode/lang types shared client+server)
Read: `nodes/46.C1_EoNGo.js` (create/settings UI + validation), `nodes/47.CnFk-avZ.js`, `dashboard.html`.

## Implementation Steps
1. Define `SessionConfig` type + mode/lang enums in `session-config.ts` (single source, DRY).
2. `POST /api/sessions`: validate mode↔lang combo (Two-Way needs language_a+b; One-Way needs source+target; None needs neither), encrypt title, insert session + host participant in a txn.
3. `GET /api/sessions`: list caller's sessions (RLS).
4. `session/[id]` route: load config via GET, render shell + participant list (no captions yet).
5. `join/+server.ts`: insert participant status=active (guest → user_id null, generate participant id).
6. `end`: host-only guard, set status=ended.
7. `sessions/new` form: mode picker drives which language selects show (clone UI logic from node 46).

## Todo
- [ ] `session-config.ts` types + validation
- [ ] `POST/GET /api/sessions`
- [ ] `/api/sessions/[id]` GET/PATCH/end (host guard)
- [ ] `/api/sessions/[id]/join`
- [ ] `crypto.ts` title encrypt/decrypt
- [ ] `sessions/new` form UI (mode-driven lang fields)
- [ ] `session/[id]` shell + participant list
- [ ] `join` page

## Success Criteria
- Create Two-Way session → row has language_a+b set, mode='Two-Way'.
- Non-host end attempt → 403.
- Guest join → participant row user_id null, status active.
- Title round-trips through encrypt/decrypt equal to input.

## Test Matrix
- Unit: mode↔lang validation matrix (all 3 modes valid+invalid), crypto round-trip.
- Integration: create→join→end lifecycle; RLS deny reading another user's private session.
- E2E: login → create → land on session/[id] shell.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Invalid mode/lang combos reach pipeline | Med×High | Central validation in `session-config.ts`, reused by server + form |
| Encryption key mgmt undecided | High×Med | Stub `encryption_key_ref` now; finalize KMS/derive in Phase 2 (unresolved Q2) |
| Guest identity collision | Low×Med | Server-generated participant UUID, never client-supplied |

## Rollback
Feature-flag `sessions/new` route; revert = disable route + `end` all active sessions. Data additive.

## Security
Host-only mutations enforced server-side (not UI). Title never stored plaintext. Join by link uses unguessable session id (uuid). RLS scopes reads.

## Next Steps
Blocks Phase 2 (needs SessionConfig + participantId). Join-request approval + participants channel → Phase 4.
