# Meet Plus — Rebuild Strategy Research

Nguồn chính: mirror bundle `_reverse/mirror/_app/immutable` (299 files) + reverse-eng spec `~/plans/reports/reverse-260710-0757-meet-plus-architecture.md` + web docs chính thức (Centrifugo, Supabase, Soniox).

## ⚠️ Correction quan trọng vs spec ban đầu

Spec gốc giả định **OpenAI Speech-to-Text** cho realtime transcription. Bundle (privacy policy nhúng trong `chunks/DGOoA49m.js`, section 4 "Third-Party Services", tự thân app khai) xác nhận khác:

- **Soniox** = ASR + dịch realtime (streaming) — engine DUY NHẤT xử lý audio.
- **OpenAI hoặc Google Gemini** = chỉ dùng cho "Meeting Minutes" (tóm tắt async, on-demand khi host bấm nút) — KHÔNG liên quan pipeline audio realtime.

Đây là nguồn cấp 1 (first-party privacy policy text của chính app, không phải suy đoán) → độ tin cậy cao nhất trong report này.

---

## 1. Khai thác mirror bundle (de-minify) — mức độ & công cụ

**Công cụ dùng thành công:** `npx --yes prettier@3 --parser babel <file>.js` — chạy tốt trên mọi file (entry/nodes/chunks), không cần cài global (đúng rule "never global npm/pip install"). Output: format lại thành code đọc được (tên biến vẫn bị rút gọn 1-2 ký tự do minify/Rollup, nhưng logic/control-flow/string-literal rõ ràng 100%).

- `js-beautify`, `webcrack` không có sẵn máy này, không thử; prettier đủ dùng vì code là ESM chuẩn (Vite/Rollup output), không bị obfuscate (chỉ minify + mangle tên).
- Không có source map (`.map` files không có trong mirror) → không map lại được tên biến/file gốc Svelte, nhưng **string literals** (i18n keys, class names, comment cảnh báo tiếng Việt của dev, error messages) sống sót nguyên vẹn qua minify → đây là nguồn thông tin giá trị nhất.
- SvelteKit client manifest: KHÔNG nằm trong `app.[hash].js` (đó là runtime generic). Nó nằm **inline trong HTML** mỗi route, dạng `kit.start(app, element, {node_ids:[...], data:[...]})` — mirror chỉ có 3 HTML (index/login/dashboard) nên chỉ thấy manifest của 3 route đó. `nodes/0..49.js` = 50 page/layout component đã build, đọc được qua prettier.
- Kỹ thuật hiệu quả: `grep -c` trước để tránh regex backtrack trên minified 1-dòng-cực-dài (đã gặp timeout 2 phút với `grep -o ".{0,80}kw.{0,80}"` trên file 1 dòng); thay bằng Python `str.find()` + slice bounded — an toàn, nhanh.
- Đã trích xuất được: channel-naming map, caption payload schema, admin debug-panel labels (tiếng Việt, do dev viết) tiết lộ toàn bộ kiến trúc pipeline nội bộ (xem mục 2-3).

**Kết luận:** de-minify bằng prettier tái tạo được ~80% giá trị spec (logic, data shape, endpoint, config keys, tên bảng/cột, comment nội bộ) dù không tái tạo được kiến trúc component Svelte gốc hay tên biến có nghĩa.

---

## 2. Pipeline transcription + dịch realtime

### Kiến trúc xác nhận từ bundle
Component debug panel `admin/queue-health` (`nodes/36.C0tl7wbP.js`, tooltip tiếng Việt của dev) mô tả chính xác luồng nội bộ:

```
Browser mic/tab-audio (getUserMedia/MediaRecorder, WSS)
  → realtime_server (Node.js, WebSocket ingest)
    → Soniox streaming API (ASR + dịch trong 1 API call, đa ngôn ngữ)
      → processTokens() — buffer/flush token, KHÔNG chờ DB/broadcast (fire-and-forget)
        → saveTranscript() → Supabase Postgres (mã hoá AES-256-GCM, retry 100/200/400ms, tối đa 3 lần)
        → broadcast qua Supabase Realtime channel.send() [LEGACY] hoặc Centrifugo [MỚI] (feature flag)
          → clients (web/extension/desktop)
```

- 4 service component giám sát: `web`, `extension`, `realtime_server`, `queue_worker`.
- Metric server tự theo dõi: DB save p95 (cảnh báo >300ms/nguy hiểm >1000ms), broadcast p95 (>100/>500ms), token-process p95 (>50/>200ms), event-loop-lag (>50/>200ms), heap (>200MB/>400MB), **"thiếu dịch"** = tỉ lệ final-flush không có bản dịch (do Soniox trả trễ/orphan hoặc mistag ngôn ngữ) — cảnh báo >10%/nguy hiểm >25%.
- Payload publication qua Centrifugo channel `captions:session:{id}`: `{event: "caption"|"caption_final", payload:{text, translations:{lang:text}, isFinal, participantId, sequenceNumber, speakerId, speakerName, lang}}`. Client chỉ hiển thị `translations[Object.keys(translations)[0]]` → server dịch 1 lần/utterance, map theo ngôn ngữ đích (hỗ trợ nhiều target languages cùng lúc, client chọn 1).
- Translation modes (UI + Supabase `sessions` columns quan sát được: `mode`, `no_translation`, `source_language`, `target_language`, `language_a`, `language_b`): **None** (transcription only), **One-Way** (source→target), **Two-Way** (languageA↔languageB, dùng cho hội thoại song ngữ).
- **No-Record Mode** (`no_record` column): bỏ qua ghi DB hoàn toàn, chỉ phát realtime — audio KHÔNG BAO GIỜ lưu (chỉ xử lý in-memory rồi discard, kể cả record mode thường).
- Reconnect: client mic tự retry, ngắt kết nối sau 3 lần fail tới "transcription server".

### So sánh nhà cung cấp ASR streaming + dịch

| Provider | Latency | Giá streaming | Dịch tích hợp | Ghi chú |
|---|---|---|---|---|
| **Soniox** (đã dùng, xác nhận) | <200ms | $0.12/h STT, ~$0.18/h có dịch | Có, 60+ ngôn ngữ/3600 cặp, cùng 1 API call | WER thấp nhất trong benchmark 2026 (1.25% EN); rẻ hơn Google/Azure ~8 lần |
| OpenAI (Realtime API / gpt-4o-transcribe) | trung bình, tốt cho hội thoại 2 chiều nhưng không tối ưu multi-speaker dài | cao hơn Soniox đáng kể theo phút | dịch = phải tự làm bằng LLM riêng (2 bước, tăng latency+cost) | Không có giải pháp streaming-translation tích hợp 1-call như Soniox |
| Deepgram | thấp, tốt | tương đương/cao hơn Soniox nhẹ | không tích hợp dịch realtime | mạnh về diarization, nhưng phải thêm bước dịch riêng |
| AssemblyAI | trung bình | cạnh tranh | không tích hợp dịch realtime | WER cao hơn Soniox theo benchmark trên |
| Gladia | thấp-trung bình | cạnh tranh | có wrapper dịch nhưng non-native | ít production case study hơn |

**Khuyến nghị:** Giữ **Soniox** làm engine ASR+dịch — đây chính là engine gốc, rẻ nhất, latency thấp nhất, và duy nhất có dịch realtime tích hợp cùng API call (tránh kiến trúc 2-bước ASR→LLM-dịch tốn thêm 1 network hop + cost). Dùng OpenAI/Gemini (chat completion, không phải Realtime API) CHỈ cho tính năng Meeting Minutes on-demand — giữ nguyên đúng kiến trúc gốc.

**Nguồn:** [Soniox pricing](https://soniox.com/pricing), [Soniox vs OpenAI comparison](https://soniox.com/compare/soniox-vs-openai), [Soniox speech-translation](https://soniox.com/speech-translation), bundle text (`chunks/DGOoA49m.js`, `nodes/36.C0tl7wbP.js`).

---

## 3. Centrifugo — self-host & tích hợp

### Channel scheme xác nhận từ bundle (`chunks/Cx0uHDNg.js`, hàm nội bộ)
```js
captions:               (sessionId) => `captions:session:${sessionId}`
settings:                (sessionId) => `settings:session:${sessionId}`
participants:            (sessionId) => `participants:session:${sessionId}`
joinRequestHost:         (sessionId) => `join-request-host:session:${sessionId}`
joinRequestApplicant:    (participantId) => `join-request-applicant:participant:${participantId}`
sessionHistory:          (sessionId) => `session-history:session:${sessionId}`
calendarSync:            (userId) => `calendar-sync:user:${userId}`
```
- Endpoint token: `/api/centrifugo-token` (theo session, dùng `sessionId`) và `/api/centrifugo-user-token` (theo user, `userId`) — 2 client riêng biệt (`centrifuge-client` vs `centrifuge-user-client`), cùng pattern: `getToken()` gọi endpoint kèm `credentials:"include"` + optional `Authorization: Bearer <accessToken>`.
- Token endpoint validate: chỉ chấp nhận relative path hoặc same-origin URL (chặn cross-origin token endpoint) — pattern bảo mật đáng note khi rebuild.
- `runtimeFlags.centrifugoEnabled` — feature flag global bật/tắt Centrifugo; app gốc ĐANG MIGRATE từ Supabase Realtime (broadcast + postgres_changes) sang Centrifugo theo allowlist (`admin/centrifugo-allowlist` route, nút `force_centrifugo` "Phase 2 override" trong debug panel). → Đây là artefact lịch sử migration, KHÔNG cần rebuild lại dual-path — build thẳng Centrifugo-only.
- Centrifugo JWT: claim `sub` (user id), `exp`, optional `channels` (server-side auto-subscribe). Config `client.token.hmac_secret_key` (hoặc RSA/ECDSA). Refresh tự động qua client SDK khi gần hết hạn.

### So sánh với thay thế

| Giải pháp | Self-host | Chi phí ở scale | Presence/private channel | Phù hợp SvelteKit |
|---|---|---|---|---|
| **Centrifugo** (đã dùng) | Có (Go binary/Docker, HA qua Redis/Nats broker) | Rẻ (compute only), triệu connection/1 node | Có sẵn (presence, private channel qua JWT) | Tốt — JS SDK generic, chỉ cần 1 endpoint token trong SvelteKit route |
| Supabase Realtime (self-host) | Có (Elixir server, cùng code Supabase dùng) | Rẻ nếu đã có Postgres, nhưng scale kém hơn ở connection cực lớn | Có (Postgres CDC + broadcast) | Rất tốt nếu đã dùng Supabase (native `.channel()` API) — chính là path LEGACY app đang bỏ dần |
| Ably | Không (chỉ managed) | Đắt ở scale lớn, nhưng SLA 99.999% | Rất tốt, built-in | Tốt, nhưng vendor lock-in + cost cao cho use-case captions tần suất cao |
| Soketi (Pusher-compatible) | Có | Rẻ | Cơ bản, ít tính năng hơn Centrifugo | Cần thêm lib pusher-js, ít mature hơn Centrifugo cho use-case này |

**Vì sao Centrifugo hợp lý ở đây:** volume message cực cao (mỗi caption token = 1 broadcast, nhiều session đồng thời) → cần server chuyên biệt hiệu năng cao, không muốn tải thêm vào Postgres/Supabase Realtime (vốn đã ghi transcript liên tục); tách biệt concern DB vs pub/sub giảm nghẽn chéo (đúng như debug-panel note "tránh nghẽn chéo giữa sessions"). Chi phí self-host thấp hơn Ably nhiều ở tần suất message cao. Rebuild giữ nguyên Centrifugo.

**Nguồn:** [Centrifugo auth docs](https://centrifugal.dev/docs/server/authentication), [Centrifugo comparisons](https://centrifugal.dev/docs/getting-started/comparisons), [Ably: Centrifugo vs Supabase Realtime](https://ably.com/compare/centrifugo-vs-supabase), bundle (`chunks/DmVYUd_c.js`, `chunks/BMq5l5jG.js`, `chunks/Cx0uHDNg.js`).

---

## 4. Supabase schema tái dựng (đề xuất)

Dựa trên cột quan sát được qua `postgres_changes` filter và JS code (`nodes/46.C1_EoNGo.js`):

**`sessions`**: `id (uuid pk)`, `host_id (fk users)`, `status (active|ended)`, `mode`, `no_translation (bool)`, `no_record (bool)`, `source_language`, `target_language`, `language_a`, `language_b`, `title_encrypted (text, AES-256-GCM)`, `started_at`, `active_recording_source`, `active_recording_participant_id (fk)`, `active_recording_disconnected_at`, `encryption_key_ref` (per-session key theo privacy policy).

**`session_participants`**: `id`, `session_id (fk)`, `user_id (fk, nullable nếu guest)`, `role (host|participant)`, `status (pending|approved|active|left)`, `joined_at`, `muted (bool)`.

**`mic_active_segments`**: theo dõi ai đang nói (start/end timestamp) — dùng cho speaking-time analytics + admin dashboard.

**`context_sets`**: vocabulary/thuật ngữ tuỳ chỉnh gửi cho Soniox (`context terms` — xác nhận từ privacy policy "optional vocabulary context terms to improve accuracy") — liên kết `/api/context-sets/ai-gen-text|ai-gen-file` (AI sinh thuật ngữ từ text/file upload).

**`session_tags` + `session_tag_assignments`**: many-to-many tag cho session.

**`session_bookmarks`**: user bookmark 1 thời điểm/segment trong transcript.

**`calendar_sync_connections`**: Google Calendar OAuth token + rule tự tạo session từ event (đọc quyền tối thiểu, chỉ **ngày hiện tại**).

**`feedbacks`** + storage bucket `feedback-images`.

**`users`**: `id`, `email`, `name`, `avatar_url`, `role (admin|user)`, `status`, `premium (bool)`, `quota_used`, `quota_reset_at` — hỗ trợ `/api/admin/users/update-{role,status,premium}` + `/api/quota/status`.

**API keys table** (mới phát hiện, không có trong spec gốc): named PAT cho tính năng "AI agent tích hợp MCP-style" (đọc-only: search/lấy transcript, minutes) — route `/settings/api-keys`, pattern show-once + revoke. Cần bảng riêng `api_keys (id, user_id, key_hash, name, last_used_at, created_at)`.

**RLS:** mỗi bảng scope theo `user_id`/`session_id ∈ (SELECT session_id FROM session_participants WHERE user_id = auth.uid())`. RPC `approve_join_request/reject_join_request/invite_participant/request_to_join` nên viết `SECURITY DEFINER`, đặt ngoài schema `public` exposed-API để tránh lộ qua REST, gọi qua `supabase.rpc()` — theo pattern chuẩn Supabase (tránh RLS recursion, index `user_id`/`session_id` bắt buộc).

**Auth:** Supabase Auth + Google OAuth provider (chuẩn, không cần custom) — chỉ request scope `openid email profile` + Calendar read-only riêng qua Google API (không qua Supabase Auth scope).

**Nguồn:** [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security), [RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices), bundle (`nodes/46.C1_EoNGo.js` lines 3306-3348, `chunks/DGOoA49m.js`).

---

## 5. Chiến lược rebuild theo phase

| Phase | Nội dung | Ước lượng (1 dev full-time) |
|---|---|---|
| **0. Nền tảng** | Supabase project + schema + RLS + Google OAuth; SvelteKit skeleton; Centrifugo self-host (Docker) + token endpoint | 3-5 ngày |
| **1. MVP lõi** | 1 session realtime: mic capture → Soniox streaming → Centrifugo broadcast `captions:session:*` → live caption UI (không dịch, không lưu DB) | 1-1.5 tuần |
| **1b. Dịch + lưu** | Bật translation modes (None/One-Way/Two-Way), lưu transcript mã hoá AES-256-GCM, No-Record mode | 3-5 ngày |
| **2. Quản lý session** | Dashboard, sessions CRUD, join-request flow (RPC + `join-request-*` channels), participants/settings channel, bookmarks, tags, search | 1.5-2 tuần |
| **3. Meeting Minutes + Context** | OpenAI/Gemini summarization on-demand, context-sets (vocab terms cho Soniox), AI-gen text/file | 3-5 ngày |
| **4. Admin/Calendar/Quota** | Admin dashboard, quota/premium logic, Calendar sync (Google), feedback, centrifugo-allowlist (bỏ qua nếu build thẳng Centrifugo-only) | 1-1.5 tuần |
| **5. Extension/Desktop** | Chrome Extension (tab-audio Google Meet) + Desktop app | Riêng biệt, có thể hoãn tới sau MVP (không block core product) |

**Tổng MVP khả dụng (phase 0-2):** ~4-5 tuần 1 dev. Full parity (phase 0-4, không tính extension/desktop): ~7-9 tuần.

**Approach đề xuất:** build thẳng Centrifugo-only (bỏ code path Supabase Realtime broadcast legacy — đó là artefact migration của app gốc, không phải kiến trúc đích). Ưu tiên phase 1 (audio→Soniox→Centrifugo) làm risk-reduction sớm nhất vì đây là phần phức tạp nhất kỹ thuật (WebSocket 2 chiều, backpressure, encryption).

---

## Unresolved questions

1. Soniox context/vocabulary API chi tiết (định dạng gửi context terms) — cần đọc doc Soniox `docs/stt/rt/real-time-transcription` kỹ hơn trước khi implement (chưa fetch sâu, chỉ có tóm tắt search).
2. Cơ chế chính xác tạo/lưu per-session encryption key (AES-256-GCM) — bundle chỉ nói "per-session key", không rõ key management (KMS? derive từ session id + master secret? Supabase Vault?).
3. Chính sách quota (`quota_used`, giới hạn theo phút/tháng, premium override) — không quan sát được giá trị cụ thể, chỉ thấy endpoint tồn tại.
4. Chrome Extension & Desktop app kiến trúc (tab-audio capture, Electron?) — ngoài phạm vi mirror bundle (không có trong 299 file), cần nghiên cứu riêng nếu ưu tiên.
5. Centrifugo presence dùng cho tính năng gì cụ thể trong app (participant online status?) — thấy `.presence()`/`.presenceStats()` trong client lib nhưng chưa xác nhận usage cụ thể trong nodes.

**Status:** DONE
**Summary:** Xác nhận + sửa quan trọng: ASR/dịch realtime dùng Soniox (không phải OpenAI) — OpenAI/Gemini chỉ cho meeting-minutes async; đã trích xuất chính xác Centrifugo channel scheme, caption payload schema, và schema Supabase đề xuất từ de-minified bundle; kèm so sánh trade-off + roadmap 5 phase.
