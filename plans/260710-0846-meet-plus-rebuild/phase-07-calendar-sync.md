# Phase 7 — Calendar sync (Google)

**Priority:** P3 · **Status:** pending · **Depends:** Phase 1, 4 · **Effort:** 4-6d

## Context Links
- Endpoints + channel: arch spec lines 28-29; strategy §4 (`calendar_sync_connections`, minimal scope, current-day only), §3 (`calendar-sync:user:{id}` channel)
- Mirror: routes `/settings` calendar section, `chunks/Cx0uHDNg.js` (calendarSync channel)

## Overview
Connect Google Calendar (read-only, current day only), auto-create sessions from calendar events via user-defined rules. Live sync status pushed on `calendar-sync:user:{id}`.

## Key Insights
- Separate Google API OAuth (Calendar read-only scope) — NOT via Supabase Auth scope (per strategy §4). Store token in `calendar_sync_connections`.
- Minimal permission: read **current day** events only (privacy-conscious per bundle).
- Endpoints: `/api/calendar-import/apply-rule`, `/api/calendar-import/create-sessions`.
- Rule = map calendar event → session config (title, mode, langs).

## Requirements
Functional: connect/disconnect Google Calendar; define import rule; auto-create sessions from today's events; live sync status.
Non-functional: token stored encrypted; scope read-only; refresh token handling.

## Architecture / Data flow
```
Connect ─► Google OAuth (calendar.readonly) ─► store token in calendar_sync_connections
POST /api/calendar-import/apply-rule {rule} ─► persist rule
POST /api/calendar-import/create-sessions ─► fetch today events ─► map via rule ─► create sessions (Phase 1)
sync status ─► publish calendar-sync:user:{id}
```

## Related Code Files
Create:
- `src/routes/settings/+page.svelte` (calendar connect section)
- `src/routes/api/calendar-import/apply-rule/+server.ts`
- `src/routes/api/calendar-import/create-sessions/+server.ts`
- `src/lib/server/google-calendar/client.ts` (OAuth + events fetch, token refresh)
- `src/lib/server/google-calendar/rule.ts` (event→SessionConfig mapping)
Read: `chunks/Cx0uHDNg.js`, Phase 1 `session-config.ts`.

## Implementation Steps
1. Google OAuth flow (calendar.readonly), store encrypted token in `calendar_sync_connections`.
2. Rule persistence (apply-rule) + mapping logic (event→SessionConfig).
3. create-sessions: fetch today's events, filter/map via rule, create sessions (reuse Phase 1 create).
4. Publish sync status to calendar-sync channel; settings UI shows connection + last sync.
5. Token refresh handling + disconnect (revoke + delete row).

## Todo
- [ ] Google Calendar OAuth (read-only, encrypted token)
- [ ] apply-rule endpoint + rule mapping
- [ ] create-sessions from today's events
- [ ] calendar-sync channel status
- [ ] settings UI connect/disconnect + refresh

## Success Criteria
- Connect → token stored encrypted; today's events fetchable.
- Rule applied → matching event auto-creates a session with mapped config.
- Disconnect → token revoked + row removed.

## Test Matrix
- Unit: event→SessionConfig mapping; rule matching.
- Integration: OAuth token store/refresh (mock Google); create-sessions from seeded events.
- E2E: connect → apply rule → sessions appear.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| OAuth token leak | Low×High | Encrypt at rest; read-only scope; server-only |
| Duplicate session creation | Med×Med | Idempotency key per event id + day |
| Google API quota/rate | Low×Med | Current-day only; cache; backoff |

## Security
Read-only calendar scope. Token encrypted, server-only, revocable. Per-user RLS on connections.

## Rollback
Feature-flag calendar section; disable = hide + stop sync. Tokens revocable. Additive schema.

## Next Steps
Depends 1 (session create) + 4 (dashboard shows created sessions). Independent of pipeline.
