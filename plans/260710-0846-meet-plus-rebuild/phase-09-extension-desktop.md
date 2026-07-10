# Phase 9 — Extension + Desktop (DEFERRED)

**Priority:** P3 · **Status:** pending (out of MVP) · **Depends:** Phase 2 · **Effort:** separate track

## Context Links
- Strategy §5 (phase 5 = extension/desktop, deferable), Unresolved Q4 (architecture not in mirror): `../reports/researcher-260710-0825-meet-plus-rebuild-strategy.md`
- Arch spec: `/api/desktop-download/`, Google Meet integration

## Overview
Chrome Extension (capture tab-audio from Google Meet) + Desktop app. **Not in mirror bundle** (0 of 299 files) → architecture must be researched fresh. Deferred until after MVP + full web parity. Does NOT block core product.

## Key Insights
- Extension is one of the 4 monitored service components (`extension` in queue-health) → it connects to the SAME `realtime_server` WSS ingest as the web mic (Phase 2). Reuses the entire pipeline — only the audio SOURCE differs (tab-audio vs mic).
- Desktop app similarly a thin capture client → realtime_server. `/api/desktop-download/` serves the installer.
- Q4 open: capture mechanism (chrome.tabCapture), desktop framework (Electron?) — needs dedicated research before planning.

## Requirements (high-level, to detail later)
Functional: extension captures Google Meet tab-audio → streams to realtime_server → captions overlay; desktop app captures system/mic audio similarly; download endpoint serves installer.
Non-functional: reuse Phase 2 pipeline unchanged (extension/desktop = alternate ingest clients only).

## Architecture / Data flow
```
Chrome Extension: chrome.tabCapture(Meet tab) ─► WSS /realtime (same as Phase 2) ─► pipeline
Desktop app: system audio capture ─► WSS /realtime ─► pipeline
/api/desktop-download/ ─► serve installer artifact
```

## Related Code Files (tentative — pending Q4 research)
- `apps/extension/` (manifest v3, tabCapture, WS client)
- `apps/desktop/` (framework TBD)
- `src/routes/api/desktop-download/+server.ts`

## Implementation Steps (pre-work)
1. **Research spike (Q4)**: chrome.tabCapture + Meet DOM injection; desktop framework choice (Electron vs Tauri). Produce a dedicated plan before coding.
2. Reuse Phase 2 WSS ingest contract (control frame + audio frames) — no server changes expected.
3. Extension MVP: capture + stream + minimal overlay.
4. Desktop MVP + download endpoint.

## Todo
- [ ] Research spike: tabCapture + desktop framework (resolve Q4) → separate plan
- [ ] Extension capture→stream→overlay
- [ ] Desktop capture client
- [ ] desktop-download endpoint

## Success Criteria
- Extension in a Meet call → live captions matching web behavior via same pipeline.
- Desktop app streams audio → captions.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Architecture unknown (Q4) | High×Med | Research spike first; do not plan detail until resolved |
| Google Meet DOM changes break overlay | Med×Med | Isolate injection layer; feature-detect |
| Store review/signing delays | Med×Low | Plan lead time; not on critical path |

## Security
Extension requests minimal permissions (tabCapture + host Meet only). Same WSS auth as web. Installer signed.

## Rollback
Fully independent apps — disabling has zero web impact. Pipeline unchanged.

## Next Steps
Deferred post-MVP. Requires Q4 research spike → own plan. Depends 2 (pipeline).
