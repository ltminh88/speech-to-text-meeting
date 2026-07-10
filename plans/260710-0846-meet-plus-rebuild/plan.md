---
title: "Meet Plus — Rebuild from scratch (functional clone)"
description: "Reimplement Meet Plus real-time translation + meeting-minutes app on SvelteKit + Supabase + Centrifugo + Soniox, from mirror front-end spec."
status: pending
priority: P1
effort: 7-9 weeks (1 dev); MVP core (phase 0-3) ~3-4 weeks
branch: infra/ecs-terraform-environment
tags: [rebuild, sveltekit, supabase, centrifugo, soniox, realtime, reverse-engineering]
created: 2026-07-10
---

# Meet Plus — Rebuild Plan

Functional clone. Repo gốc mất; nguồn spec = mirror front-end minified tại
`_reverse/mirror` (299 files). Beautify bằng `npx --yes prettier@3 --parser babel`.
Server `/api/*`, RLS, pipeline Soniox = PHẢI reimplement (không có trong client).
UI/state logic = tái dùng được sau khi beautify (không copy trực tiếp — đọc để clone hành vi).

## Context
- Arch spec: `/Users/minhlt/plans/reports/reverse-260710-0757-meet-plus-architecture.md`
- Rebuild strategy (schema, channels, pipeline thật): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Mirror bundle: `/Users/minhlt/Downloads/Projects/speech-to-text-meeting/_reverse/mirror/_app/immutable`

## Kiến trúc đích (chốt)
SvelteKit (SSR+CSR) · Supabase (Postgres + Google OAuth + RLS) · Centrifugo self-host (pub/sub captions)
· Soniox streaming (ASR+dịch 1-call) · OpenAI/Gemini (chỉ meeting-minutes async).
Build **Centrifugo-only** — bỏ code path Supabase Realtime legacy (artefact migration của app gốc).

## Phases

| # | Phase | Status | Blocks / Depends | Effort |
|---|-------|--------|------------------|--------|
| 0 | [Foundation & Infra](phase-00-foundation-infra.md) | done ✅ | blocks all | 3-5d |
| 1 | [Google Auth + Session lifecycle](phase-01-auth-session-lifecycle.md) | done ✅ | dep 0 | 3-4d |
| 2 | [Realtime pipeline (Soniox+Centrifugo)](phase-02-realtime-pipeline.md) ⭐ | done ✅ | dep 0,1 | 1.5-2w |
| 3 | [Meeting Minutes export](phase-03-meeting-minutes.md) | done ✅ | dep 2 | 3-5d |
| 4 | [Session management (dashboard/join/tags/bookmarks/search)](phase-04-session-management.md) | pending | dep 1,2 | 1.5-2w |
| 5 | [Context sets + AI-gen vocab](phase-05-context-sets.md) | pending | dep 2 | 3-5d |
| 6 | [Admin panel + quota/premium](phase-06-admin-quota.md) | pending | dep 1,4 | 1-1.5w |
| 7 | [Calendar sync (Google)](phase-07-calendar-sync.md) | pending | dep 1,4 | 4-6d |
| 8 | [API keys (PAT / read-only)](phase-08-api-keys.md) | pending | dep 4 | 2-3d |
| 9 | [Extension + Desktop (DEFERRED)](phase-09-extension-desktop.md) | pending | dep 2 | out-of-MVP |

⭐ = highest technical risk, build earliest for risk reduction.

## Dependency graph
```
0 ──► 1 ──► 2 ──► 3
      │     ├──► 4 ──► 6
      │     ├──► 5     └► 8
      │     └──► 9
      └────────► 7 (also dep 4)
```

## MVP lõi (ưu tiên user) = Phase 0 → 1 → 2 → 3
Google auth → tạo/join session → realtime transcription & dịch → xuất meeting minutes.

## Reimplement vs Reuse (tổng quan)
- **PHẢI reimplement (server-side, không có trong client):** toàn bộ `/api/*` handlers, `realtime_server` (Node WS ingest ↔ Soniox), RLS policies + RPC, Centrifugo config + token endpoints, AES-256-GCM transcript encryption, quota/premium logic.
- **Tái dùng (đọc từ beautified mirror, clone hành vi):** UI layout/component tree, i18n keys, client-side state machines (reconnect, caption render), channel-name helpers (`chunks/Cx0uHDNg.js`), caption payload shape.

## Cross-cutting (mọi phase)
- Env secrets qua `.env` (Supabase keys, Soniox key, Centrifugo HMAC, OpenAI/Gemini) — KHÔNG commit.
- Mỗi file code < 200 dòng (dev-rules); kebab-case; SvelteKit route = `+server.ts`/`+page.svelte`.
- Test matrix + rollback + risk chi tiết trong mỗi phase file.
