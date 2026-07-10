# Phase 5 — Context sets + AI-gen vocab

**Priority:** P2 · **Status:** pending · **Depends:** Phase 2 · **Effort:** 3-5d

## Context Links
- Strategy §4 (context_sets = Soniox vocabulary terms), §2/Unresolved Q1 (Soniox context format): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Mirror: `nodes/46.C1_EoNGo.js` (contexts.* i18n keys observed), routes `/contexts`

## Overview
Custom vocabulary/terminology ("context sets") that improve Soniox accuracy. User creates term sets manually or via AI generation from text/file. Selected context set feeds the Soniox request in Phase 2 pipeline.

## Key Insights
- `context_sets` linked to Soniox "context terms" (per privacy policy). Support public + private sets.
- AI-gen endpoints: `/api/context-sets/ai-gen-text` (from pasted text) and `/api/context-sets/ai-gen-file` (from upload) — LLM extracts domain terms.
- **Blocked-by Unresolved Q1**: confirm Soniox context-terms request format before wiring into pipeline.

## Requirements
Functional: CRUD context sets; AI-generate terms from text/file; select a set when creating/running a session → passed to Soniox.
Non-functional: file upload size-limited; AI-gen async with loading state.

## Architecture / Data flow
```
POST /api/context-sets (CRUD) ─► context_sets rows
POST /api/context-sets/ai-gen-text {text} ─► LLM extract terms ─► term list
POST /api/context-sets/ai-gen-file {file} ─► parse+extract ─► term list
session create (Phase 1) selects set ─► terms attached to SessionConfig ─► Soniox request (Phase 2)
```

## Related Code Files
Create:
- `src/routes/contexts/+page.svelte`
- `src/routes/api/context-sets/+server.ts` (CRUD)
- `src/routes/api/context-sets/ai-gen-text/+server.ts`
- `src/routes/api/context-sets/ai-gen-file/+server.ts`
- `src/lib/server/context-terms/extract.ts` (LLM term extraction, reuse summarizer adapter DRY)
Read: `nodes/46.C1_EoNGo.js`; Soniox real-time docs (resolve Q1).

## Implementation Steps
1. Resolve Q1: read Soniox `docs/stt/rt/real-time-transcription` for context-terms format; document in `soniox-client.ts` (Phase 2).
2. context_sets CRUD (public/private scope via RLS).
3. ai-gen-text: reuse summarizer adapter to extract terms.
4. ai-gen-file: parse (txt/pdf/docx) → extract; size limit + type allowlist.
5. Wire selected set into SessionConfig → Soniox request in pipeline.

## Todo
- [ ] Resolve Soniox context-terms format (Q1)
- [ ] context_sets CRUD + RLS (public/private)
- [ ] ai-gen-text
- [ ] ai-gen-file (parse + limits)
- [ ] Attach set → SessionConfig → Soniox request

## Success Criteria
- Create set with 10 terms → selectable on session create.
- ai-gen-text on a paragraph → ≥5 relevant terms.
- Session with context set → Soniox accuracy improves on domain terms (spot-check).

## Test Matrix
- Unit: term extraction parsing; file type/size guard.
- Integration: CRUD + RLS public/private visibility; set→SessionConfig propagation.
- E2E: create set → run session → terms in Soniox request.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Soniox context format unknown (Q1) | High×Med | Resolve in step 1 before wiring; isolate behind adapter |
| Malicious file upload | Med×High | Type allowlist, size cap, no exec, scan text only |
| AI-gen low-quality terms | Low×Low | User edits before save |

## Security
Private sets RLS-scoped. File upload validated + stored in isolated bucket. LLM keys server-only.

## Rollback
Feature-flag contexts route; pipeline works without a set (terms optional). Additive schema.

## Next Steps
Enhances Phase 2 accuracy. Depends 2. Independent of admin/calendar.
