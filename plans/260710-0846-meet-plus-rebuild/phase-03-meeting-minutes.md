# Phase 3 — Meeting Minutes export (async summarization)

**Priority:** P1 · **Status:** pending · **Depends:** Phase 2 · **Effort:** 3-5d

## Context Links
- Strategy §2 (OpenAI/Gemini = minutes only, on-demand): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Mirror: `nodes/46.C1_EoNGo.js` (session view — minutes/export button + i18n keys)

## Overview
Host clicks "Generate meeting minutes" → server reads the session's stored transcript (decrypt), sends to OpenAI/Gemini chat-completion (NOT Realtime API), returns structured minutes (summary, action items, decisions). On-demand, async, not part of the audio pipeline.

## Key Insights
- Uses **chat completion** (OpenAI/Gemini), provider-selectable — keep an adapter interface (DRY, provider-agnostic).
- Reads decrypted finalized transcript rows from Phase 2; no_record sessions have no transcript → minutes unavailable (surface message).
- Long transcripts → chunk + map-reduce summarize to fit context window.

## Requirements
Functional: generate minutes from transcript; export (markdown/copy); minutes persisted or regenerated on demand.
Non-functional: generation async (job/loading state, no request timeout); provider swappable via env.

## Architecture / Data flow
```
POST /api/sessions/[id]/minutes (host) ─► load+decrypt transcript rows
   ─► summarizer.adapter (openai|gemini) chunk→map-reduce ─► {summary, actionItems[], decisions[]}
   ─► return (+ optional persist) ─► UI renders + export
```
In: sessionId. Out: structured minutes JSON + rendered/exported doc.

## Related Code Files
Create:
- `src/routes/api/sessions/[id]/minutes/+server.ts`
- `src/lib/server/summarizer/index.ts` (adapter interface + provider switch)
- `src/lib/server/summarizer/openai.ts`, `src/lib/server/summarizer/gemini.ts`
- `src/lib/server/summarizer/chunk.ts` (transcript chunk + map-reduce)
- `src/routes/session/[id]/minutes/+page.svelte` (view/export UI)
Read: `nodes/46.C1_EoNGo.js`, `src/lib/server/crypto.ts` (Phase 1/2 decrypt).

## Implementation Steps
1. Define `SummarizerAdapter` interface (`summarize(transcript, opts)→Minutes`).
2. Implement openai + gemini adapters (chat completion, structured JSON output).
3. `chunk.ts`: split by token budget, summarize chunks, reduce to final minutes.
4. `minutes/+server.ts`: host guard, load+decrypt transcript, call adapter, return; handle empty/no_record.
5. UI: generate button → loading → render summary/action-items/decisions → export markdown/copy.

## Todo
- [ ] SummarizerAdapter interface + provider switch (env)
- [ ] OpenAI adapter
- [ ] Gemini adapter
- [ ] chunk + map-reduce
- [ ] minutes endpoint (host guard, decrypt, no_record handling)
- [ ] minutes UI + export

## Success Criteria
- 30-min transcript → minutes with summary + ≥1 action item in <30s.
- Provider switch via env produces minutes from both.
- no_record session → clear "no transcript to summarize" message.

## Test Matrix
- Unit: chunk boundaries, adapter response parsing, map-reduce merge.
- Integration: decrypt→summarize round-trip on seeded transcript; host-only guard.
- E2E: generate + export markdown.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Long transcript exceeds context | Med×Med | chunk + map-reduce |
| LLM cost/latency | Med×Med | on-demand only; cache last result per session |
| Non-deterministic/invalid JSON | Med×Med | schema-validate output, retry once with stricter prompt |

## Security
Host-only. Transcript decrypted in-memory only. LLM API keys server-only env. Do not send no_record content (none exists).

## Rollback
Feature-flag minutes button; endpoint isolated, reads-only → safe to disable. No schema dependency beyond transcript rows.

## Next Steps
Completes MVP core (0→1→2→3). Independent of later phases.
