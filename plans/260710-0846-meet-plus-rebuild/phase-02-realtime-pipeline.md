# Phase 2 — Realtime pipeline (Soniox + Centrifugo) ⭐

**Priority:** P1 · **Status:** pending · **Depends:** Phase 0, 1 · **Effort:** 1.5-2w
**Highest technical risk — build earliest for risk reduction.**

## Context Links
- Pipeline spec (dev debug-panel, tiếng Việt): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md` §2
- Centrifugo channel scheme + payload: strategy §3
- Mirror (READ — authoritative behavior):
  - `nodes/36.C0tl7wbP.js` — admin/queue-health: 4 service components, metric thresholds, pipeline description
  - `chunks/Cx0uHDNg.js` — channel-name helpers (`captions:session:{id}` etc.)
  - `chunks/DGOoA49m.js` — privacy policy text (Soniox = ASR+dịch, per-session encryption, no-record)
  - `nodes/46.C1_EoNGo.js` — session view: caption render, reconnect UI, `postgres_changes` column filters

## Overview
The core product. Browser captures mic/tab audio → streams over WSS to a **Node.js `realtime_server`** → forwards to **Soniox streaming API** (ASR + translation in one call) → `processTokens()` buffers/flushes tokens → **fan-out in parallel** to (a) Supabase Postgres save (AES-256-GCM, retry) and (b) Centrifugo broadcast on `captions:session:{id}`. Clients render partial (live) + final (committed) captions with the chosen translation.

## Key Insights (from bundle — treat as spec)
- **`processTokens()` is fire-and-forget**: does NOT await DB save or broadcast — decouples latency (a slow DB write must not stall captions). Both sinks run concurrently.
- **DB save**: AES-256-GCM encrypted, retry backoff **100/200/400ms, max 3 attempts** (`saveTranscript()`).
- **Broadcast payload** on `captions:session:{id}`:
  ```json
  {"event":"caption"|"caption_final",
   "payload":{"text":"", "translations":{"<lang>":"<text>"}, "isFinal":bool,
              "participantId":"", "sequenceNumber":int, "speakerId":"", "speakerName":"", "lang":""}}
  ```
  Client displays `translations[Object.keys(translations)[0]]` → server may emit multiple target langs; client picks one.
- **No-Record mode** (`no_record`): skip DB save entirely, broadcast only. Audio NEVER persisted in any mode (processed in-memory then discarded).
- **Metric thresholds the server must expose** (feeds Phase 6 queue-health): DB-save p95 warn>300ms/crit>1000ms; broadcast p95 >100/>500ms; token-process p95 >50/>200ms; event-loop-lag >50/>200ms; heap >200/>400MB; **"missing translation"** = final-flush without translation, warn>10%/crit>25% (Soniox late/orphan/mistag).
- **Client reconnect**: mic auto-retry; give up after 3 consecutive fails to transcription server (surface "disconnected" UI).
- Translation modes drive Soniox request: None→transcription only; One-Way→source→target; Two-Way→language_a↔language_b (bidirectional).

## Requirements
Functional: speaking into mic yields live partial captions <~1s, committed finals with translation; finals persisted (unless no_record); multiple participants' captions interleave with correct speaker labels; reconnect recovers without losing session.
Non-functional: token-process p95 <50ms; broadcast p95 <100ms; DB save off critical path; backpressure-safe (drop/queue audio if Soniox slow, never OOM).

## Architecture / Data flow
```
[Browser] getUserMedia + MediaRecorder/AudioWorklet (PCM/opus chunks)
   │  WSS  wss://.../realtime  (auth: session token; frames = audio + control{start,mode,langs})
   ▼
[realtime_server]  (Node.js standalone service, NOT a SvelteKit route)
   ws.onmessage(audio) ──► Soniox streaming client (per-connection)
        │  request config: languages, translation targets, context terms (Phase 5)
        ▼
   Soniox streaming tokens (partial + final, with translations, speaker tags)
        │
   processTokens(tok):  buffer partials → on final: flush   [FIRE-AND-FORGET, no await]
        ├──(A)─► saveTranscript()  → AES-256-GCM encrypt → Supabase insert  (retry 100/200/400, max3)
        └──(B)─► broadcast()       → Centrifugo publish `captions:session:{id}`  (event caption/caption_final)
   emits metrics (p95 timers, missing-translation ratio) → /api/internal/realtime-health/*
   ▼ (via Centrifugo)
[All session clients] subscribe captions:session:{id} → render partial(live)/final(committed)
```
Data in: audio frames + session config. Transforms: audio→tokens→(encrypted rows)+(pub/sub events). Out: DB transcript rows + live captions. Audio itself: discarded, never stored.

## Related Code Files
Create (realtime_server — separate Node service, own package):
- `services/realtime-server/src/server.ts` (WS ingest, per-conn lifecycle) — <200 lines
- `services/realtime-server/src/soniox-client.ts` (Soniox streaming wrapper, mode→request mapping)
- `services/realtime-server/src/process-tokens.ts` (buffer/flush, fire-and-forget dispatch)
- `services/realtime-server/src/save-transcript.ts` (AES-256-GCM + retry backoff)
- `services/realtime-server/src/broadcast.ts` (Centrifugo server API publish)
- `services/realtime-server/src/metrics.ts` (p95 timers, missing-translation ratio, heap/loop-lag)
- `services/realtime-server/Dockerfile`, add to `docker-compose.yml`
Create (SvelteKit / client):
- `src/lib/realtime/audio-capture.ts` (getUserMedia + encoder + WS send)
- `src/lib/realtime/caption-store.ts` (Svelte store: partial map + finals list, keyed by sequenceNumber)
- `src/lib/realtime/reconnect.ts` (3-strike state machine: connecting→live→retrying→failed)
- `src/routes/session/[id]/+page.svelte` (add caption panel — extend Phase 1 shell)
- `src/routes/api/broadcast/+server.ts` (server→Centrifugo helper, reused by realtime_server via internal auth)
- `src/routes/api/internal/realtime-health/[component]/+server.ts` (ingest metrics for Phase 6)
Read: nodes/36, nodes/46, chunks/Cx0uHDNg.js, chunks/DGOoA49m.js.

## Implementation Steps
1. **Encryption decision first** (unblocks save-transcript): pick key scheme — derive per-session key from master secret + session_id via HKDF (KISS, no external KMS), store `encryption_key_ref` = salt. Document in `save-transcript.ts`.
2. `realtime-server/server.ts`: WS server, authenticate connection via session token (validate against Supabase), read control frame {sessionId, participantId, mode, langs}.
3. `soniox-client.ts`: open Soniox streaming per connection; map SessionConfig→Soniox request (source/target/translation targets); pipe audio frames.
4. `process-tokens.ts`: buffer partial tokens per speaker; on final token flush → build payload (sequenceNumber++, speaker fields, translations map); dispatch to save + broadcast **without awaiting**.
5. `save-transcript.ts`: AES-256-GCM encrypt text+translations; insert; retry 100/200/400ms; if no_record → skip entirely.
6. `broadcast.ts`: publish to `captions:session:{id}` via Centrifugo HTTP API (event `caption` for partial, `caption_final` for final).
7. `metrics.ts`: wrap save/broadcast/token-process in p95 timers; track missing-translation ratio; expose via health endpoint.
8. Client `audio-capture.ts`: getUserMedia, encode, WS send; `caption-store.ts` merge partials (replace by speaker) + append finals (dedupe by sequenceNumber).
9. `reconnect.ts`: 3-strike retry with backoff; surface state to UI.
10. Wire caption panel in session/[id]; display `translations[Object.keys(translations)[0]]`.
11. Load test: 3 concurrent speakers × 2 sessions; verify metrics thresholds + no OOM.

## Todo
- [ ] Encryption key scheme (HKDF per-session) documented + implemented
- [ ] realtime-server WS ingest + auth
- [ ] Soniox streaming client + mode mapping
- [ ] processTokens buffer/flush fire-and-forget
- [ ] saveTranscript AES-256-GCM + retry 100/200/400 + no_record skip
- [ ] broadcast → Centrifugo captions channel
- [ ] metrics (p95 + missing-translation ratio) + health endpoint
- [ ] client audio-capture
- [ ] caption-store (partial/final merge by sequenceNumber)
- [ ] reconnect 3-strike state machine
- [ ] caption panel UI + translation display
- [ ] load test 3 speakers × 2 sessions

## Success Criteria (measurable)
- Speaking mic → partial caption visible <1s; final with translation committed.
- Kill DB (make save fail) → captions STILL broadcast (fire-and-forget proven); save retries 3× then drops with logged error.
- no_record session → 0 rows in transcript table after a full conversation.
- Disconnect Soniox 3× → client shows "disconnected", auto-recovers on reconnect.
- Under 3×2 load: token-process p95 <50ms, broadcast p95 <100ms, heap <200MB, no OOM.
- Two-Way session: both language directions translated correctly.

## Test Matrix
- Unit: processTokens buffer/flush ordering; retry backoff timing; payload builder; caption-store merge (out-of-order sequenceNumber); mode→Soniox request mapping.
- Integration: token→save (encrypted row decrypts equal); token→broadcast (client receives payload); no_record skip; DB-down does not block broadcast.
- E2E: 2 browsers same session, speaker A talks → speaker B sees captions+translation with correct speakerName; reconnect recovery.
- Load: concurrency + metric thresholds.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Backpressure → OOM if Soniox slower than audio in | Med×High | Bounded queue per conn; drop oldest audio frame on overflow; heap metric alarm |
| Missing translation (Soniox late/orphan/mistag) | High×Med | Track ratio metric; on missing, emit final with empty translations (client shows source); alarm >10% |
| DB save latency stalls captions | Med×High | Fire-and-forget (never await); metric p95; save off critical path by design |
| Encryption key mgmt (Unresolved Q2) | High×High | HKDF per-session from master secret (step 1); no plaintext audio ever stored |
| WS auth bypass (unauthorized ingest) | Med×High | Validate session token on connect; reject non-members; same-origin |
| Sequence/ordering races multi-speaker | Med×Med | Monotonic sequenceNumber per session; client dedupes/orders |

## Security
- Audio NEVER persisted (in-memory, discarded post-token) — matches privacy policy.
- Transcript text + translations AES-256-GCM at rest; per-session key.
- WS ingest authenticated per connection; realtime_server↔SvelteKit internal calls use shared secret.
- Centrifugo publish server-side only (clients subscribe-only on captions channel).

## Rollback
realtime_server is a separate container → `docker compose stop realtime-server` disables capture; session shells (Phase 1) still load. Client capture behind feature flag `runtimeFlags.captionsEnabled`. No schema change beyond transcript rows (safe to leave).

## Next Steps
Blocks Phase 3 (minutes read transcript rows), Phase 5 (context terms feed Soniox request), Phase 6 (consumes health metrics). Blocked-by Phase 1 (SessionConfig, participantId).

## Unresolved (carry-in)
- Q1 Soniox context-terms request format — resolve before Phase 5 wiring.
- Q2 per-session encryption key mgmt — RESOLVED here via HKDF (revisit if compliance needs external KMS).
