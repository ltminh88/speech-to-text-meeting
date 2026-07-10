# Phase 8 — API keys (PAT, read-only)

**Priority:** P3 · **Status:** pending · **Depends:** Phase 4 · **Effort:** 2-3d

## Context Links
- Strategy §4 (api_keys table, MCP-style read-only PAT, show-once + revoke): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Mirror: route `/settings/api-keys`

## Overview
Named personal access tokens for external AI-agent integration (MCP-style). **Read-only**: search sessions, fetch transcript + minutes. Show-once on creation, revocable. Not a full OAuth — simple hashed bearer tokens.

## Key Insights
- `api_keys (id, user_id, key_hash, name, last_used_at, created_at)`.
- Store only hash (e.g. SHA-256); plaintext shown once at creation.
- Read-only scope: reuse Phase 4 search + Phase 2 transcript read + Phase 3 minutes — no writes.

## Requirements
Functional: create named key (show once); list keys (masked); revoke; authenticate read-only API calls via `Authorization: Bearer <pat>`.
Non-functional: key never stored plaintext; scoped to owner's data (RLS via resolved user_id).

## Architecture / Data flow
```
POST /api/keys {name} ─► generate token ─► store hash ─► return plaintext ONCE
DELETE /api/keys/[id] ─► revoke
External call w/ Bearer PAT ─► middleware hash+lookup ─► set user context ─► read-only endpoints only
```

## Related Code Files
Create:
- `src/routes/settings/api-keys/+page.svelte` (create/list/revoke, show-once modal)
- `src/routes/api/keys/+server.ts` (POST create, GET list)
- `src/routes/api/keys/[id]/+server.ts` (DELETE revoke)
- `src/lib/server/api-key/auth.ts` (hash, verify, resolve user, read-only guard)
Read: Phase 4 search, Phase 2 transcript read, Phase 3 minutes endpoints.

## Implementation Steps
1. Key generation (random 32B) + SHA-256 hash storage; return plaintext once.
2. List (masked prefix) + revoke.
3. `api-key/auth.ts`: verify Bearer PAT, resolve user_id, update last_used_at, enforce read-only.
4. Apply PAT auth to read endpoints (search, transcript, minutes) — reject writes.
5. UI: create modal (show-once + copy), list, revoke.

## Todo
- [ ] Key gen + hash storage + show-once return
- [ ] List (masked) + revoke
- [ ] PAT auth middleware (read-only guard)
- [ ] Apply to search/transcript/minutes read endpoints
- [ ] api-keys UI

## Success Criteria
- Create key → plaintext shown once, never retrievable again.
- PAT authenticates GET search/transcript/minutes; write attempt → 403.
- Revoked key → 401.

## Test Matrix
- Unit: hash/verify; read-only guard rejects mutations.
- Integration: PAT resolves correct user; RLS scopes data; revoke invalidates.
- E2E: create key → curl search with Bearer → data returned.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Key leak = data read access | Med×High | Hash-only storage; show-once; revoke; read-only scope; last_used audit |
| Write via PAT | Low×High | Explicit read-only guard on PAT-auth path |

## Security
Hash-only (never plaintext at rest). Read-only enforced. Owner-scoped via RLS. last_used_at audit. Revocable.

## Rollback
Feature-flag api-keys route; disable = reject PAT auth + hide route. Additive schema.

## Next Steps
Depends 4 (search) + 2/3 (transcript/minutes reads). Terminal feature.
