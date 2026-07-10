# Phase 6 — Admin panel + quota/premium

**Priority:** P2 · **Status:** pending · **Depends:** Phase 1, 4 · **Effort:** 1-1.5w

## Context Links
- Admin routes + endpoints: arch spec lines 30-37; strategy §4 (users columns: role/status/premium/quota_used/quota_reset_at), §2/§6 (queue-health metrics)
- Mirror: `nodes/36.C0tl7wbP.js` (admin/queue-health debug panel — metric thresholds, 4 components)

## Overview
Admin-only console: user management (role/status/premium), quota history, feedback triage, queue-health monitoring (consumes Phase 2 metrics), centrifugo-allowlist (skip — Centrifugo-only build), plus quota/premium enforcement logic.

## Key Insights
- Admin routes: dashboard, users, quotas, feedback, queue-health, settings, centrifugo-allowlist.
- queue-health reads the metrics Phase 2 emits (`/api/internal/realtime-health/*`): DB-save/broadcast/token p95, event-loop-lag, heap, missing-translation ratio, 4 components (web/extension/realtime_server/queue_worker).
- Quota: `quota_used` + `quota_reset_at`; premium overrides limit. **Unresolved Q3**: exact quota policy (per-minute/month values) unknown → make limits config-driven env vars.
- Skip `centrifugo-allowlist` (legacy migration artefact — Centrifugo-only).

## Requirements
Functional: admin CRUD user role/status/premium; view quota history; triage feedback; live queue-health dashboard; enforce quota on session start (block if exceeded, premium bypass).
Non-functional: admin routes role-gated (RLS + route guard); metrics dashboard near-real-time.

## Architecture / Data flow
```
/api/admin/users/update-{role,status,premium} (admin) ─► users row update
/api/admin/quota-history ─► quota audit read
/api/quota/status ─► caller quota (used/limit/reset) — checked at session create (Phase 1)
realtime_server metrics ─► /api/internal/realtime-health/* ─► admin/queue-health dashboard
```

## Related Code Files
Create:
- `src/routes/admin/+layout.server.ts` (admin role guard)
- `src/routes/admin/{dashboard,users,quotas,feedback,queue-health,settings}/+page.svelte`
- `src/routes/api/admin/users/update-role/+server.ts`, `.../update-status/+server.ts`, `.../update-premium/+server.ts`
- `src/routes/api/admin/quota-history/+server.ts`
- `src/routes/api/quota/status/+server.ts`
- `src/lib/server/quota/enforce.ts` (limit check, premium bypass, config-driven)
- `src/routes/api/feedbacks/+server.ts` (+ storage bucket feedback-images)
Read: `nodes/36.C0tl7wbP.js`.

## Implementation Steps
1. Admin layout guard (role=admin, 403 otherwise) — server-side.
2. User management endpoints (update role/status/premium) + users table UI.
3. `quota/enforce.ts`: config-driven limit (env), premium bypass; call from Phase 1 session-create.
4. quota-history + quota/status endpoints + quotas UI.
5. queue-health dashboard: poll/subscribe metrics, render thresholds (warn/crit colors per node 36).
6. Feedback triage UI + feedbacks endpoint + image bucket.
7. Skip centrifugo-allowlist (document why: Centrifugo-only).

## Todo
- [ ] Admin role guard layout
- [ ] User update role/status/premium
- [ ] quota enforce.ts (config-driven + premium bypass)
- [ ] quota-history + quota/status
- [ ] queue-health dashboard (metrics + thresholds)
- [ ] feedback triage + image bucket

## Success Criteria
- Non-admin hits /admin → 403.
- Set user premium → quota check bypassed on next session create.
- Quota exceeded (non-premium) → session create blocked with clear error.
- queue-health shows live p95 + colors matching thresholds.

## Test Matrix
- Unit: quota enforce logic (under/over limit, premium, reset window); role guard.
- Integration: admin update propagates; quota check blocks create.
- E2E: admin flow login → users → toggle premium → verify.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Quota policy unknown (Q3) | Med×Med | Config-driven env limits; sane defaults; document assumption |
| Admin privilege escalation | Low×High | Server-side role guard, RLS, never trust client role |
| Metrics dashboard load | Low×Med | Poll interval + aggregate server-side |

## Security
Admin role enforced server-side + RLS. Feedback images in scoped bucket. Quota bypass only for verified premium flag (server-set).

## Rollback
Admin routes isolated behind guard; disabling = remove route. Quota enforcement behind flag (fail-open to avoid blocking users on rollback). Additive schema.

## Next Steps
Depends 1 (users) + 4 (session data). Consumes Phase 2 metrics. Independent of calendar/api-keys.
