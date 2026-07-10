# Phase 4 — Session management (dashboard/join/tags/bookmarks/search/templates)

**Priority:** P2 · **Status:** pending · **Depends:** Phase 1, 2 · **Effort:** 1.5-2w

## Context Links
- RPC list + join channels: arch spec lines 20-30; strategy §3 (join-request channels), §4 (tags/bookmarks tables)
- Mirror: `nodes/46.C1_EoNGo.js` (session view + participants/settings), `dashboard.html`, `nodes/47.CnFk-avZ.js`

## Overview
Everything around a session that isn't the live pipeline: dashboard listing, full join-request approval flow (RPC + Centrifugo channels), participants/settings live sync, bookmarks, tags, search, session templates.

## Key Insights
- Join flow uses RPC (`request_to_join`, `approve_join_request`, `reject_join_request`, `invite_participant`) + channels `join-request-host:session:{id}`, `join-request-applicant:participant:{id}`.
- Participants/settings sync via `participants:session:{id}` / `settings:session:{id}` channels.
- Tags = many-to-many (`session_tags` + `session_tag_assignments`). Bookmarks mark a transcript moment.
- Templates = reusable session config presets (client-side + `/api/templates`).

## Requirements
Functional: dashboard lists/filters sessions; applicant requests join → host approves/rejects live; participants list updates live; bookmark a moment; CRUD tags + assign; search sessions/transcripts; save/apply templates.
Non-functional: search RLS-scoped; join-request latency <500ms via channel.

## Architecture / Data flow
```
Applicant POST /api/sessions/[id]/join-request ─► rpc request_to_join ─► publish join-request-host
Host approve ─► rpc approve_join_request ─► publish join-request-applicant + participants channel
GET /api/search?q= ─► RLS-scoped query sessions + transcript (decrypt-on-read or indexed)
/api/bookmarks, /api/templates, tags endpoints ─► CRUD
```

## Related Code Files
Create:
- `src/routes/dashboard/+page.svelte` (+ server load)
- `src/routes/api/sessions/[id]/join-request/+server.ts`, `.../approve/+server.ts`, `.../reject/+server.ts`, `.../invite/+server.ts` (call supabase.rpc)
- `src/routes/api/bookmarks/+server.ts`, `src/routes/api/search/+server.ts`, `src/routes/api/templates/+server.ts`
- `src/routes/settings/tags/+page.svelte` + tags API
- `src/routes/session-templates/+page.svelte`
- `src/lib/realtime/participants-store.ts`, `src/lib/realtime/join-request-store.ts`
Read: `nodes/46.C1_EoNGo.js`, `dashboard.html`, `chunks/Cx0uHDNg.js`.

## Implementation Steps
1. Dashboard: list caller sessions (status/date filters), reuse SessionConfig types.
2. Join-request endpoints → supabase.rpc + Centrifugo publish (host + applicant channels).
3. Client stores subscribe join-request + participants channels; host UI approve/reject.
4. Bookmarks CRUD (link to sequenceNumber/timestamp in transcript).
5. Tags CRUD + assignment UI (`settings/tags`).
6. Search endpoint (sessions by title/tag; transcript search — note decrypt cost, consider searchable index later — YAGNI now: title/tag/metadata search only).
7. Templates save/apply (preset SessionConfig).

## Todo
- [ ] Dashboard list + filters
- [ ] Join-request RPC endpoints (request/approve/reject/invite)
- [ ] join-request + participants live stores
- [ ] Bookmarks CRUD
- [ ] Tags CRUD + assignment
- [ ] Search (title/tag/metadata)
- [ ] Templates save/apply

## Success Criteria
- Applicant requests → host sees request live → approve → applicant joins live (<500ms).
- Tag assign/unassign reflected in dashboard filter.
- Bookmark persists + jumps to transcript moment.
- Search returns only caller-accessible sessions (RLS).

## Test Matrix
- Unit: RPC param builders, search query builder, template serialize.
- Integration: RPC approve flow (participant status transitions pending→approved→active); RLS on search.
- E2E: two-browser join-request approve; tag filter; bookmark jump.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| RPC RLS recursion | Med×High | SECURITY DEFINER (Phase 0), indexed FKs |
| Transcript search = decrypt-all cost | Med×Med | YAGNI: metadata-only search now; defer full-text index |
| Channel/store desync on reconnect | Med×Med | Re-fetch participants snapshot on resubscribe |

## Security
All mutations RLS + host-role guarded server-side. Invite validates target user. Search scoped to membership.

## Rollback
Per-feature flags (dashboard/join/tags independent routes). RPCs additive. No pipeline dependency.

## Next Steps
Blocks Phase 6 (admin builds on session/participant data), Phase 8 (API keys search reuses search endpoint). Depends 1,2.
