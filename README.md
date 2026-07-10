# Meet Plus (rebuild)

Real-time translation & meeting-minutes system. Rebuilt from scratch on
SvelteKit + Supabase + Centrifugo + Soniox. See the plan in
`plans/260710-0846-meet-plus-rebuild/plan.md`.

## Stack
- **SvelteKit** (SSR + CSR), Tailwind — `adapter-node`
- **Supabase** (Postgres + Google OAuth + RLS)
- **Centrifugo** (self-host) — realtime captions pub/sub
- **Soniox** — streaming ASR + translation (Phase 2)
- **OpenAI / Gemini** — async meeting-minutes summarization (Phase 3)

## Phase 0 — Foundation (done)
SvelteKit skeleton, Supabase schema/RLS/RPC, Google auth plumbing,
Centrifugo config + token endpoints, channel helpers.

## Setup
1. `npm install`
2. Copy env: `cp .env.example .env` and fill real values
   (Supabase URL/keys, `CENTRIFUGO_HMAC_SECRET`, `CENTRIFUGO_API_KEY`).
3. Create a Supabase project, enable the **Google** auth provider
   (scopes `openid email profile`), set the redirect to
   `http://localhost:5173/auth/callback`.
4. Apply migrations (Supabase CLI): `supabase db push`
   (or paste `supabase/migrations/*.sql` into the SQL editor in order).
5. Start Centrifugo — **Podman** (no Docker needed):
   `podman compose up -d`
   or the bare binary: `brew install centrifugo && npm run centrifugo`.
6. `npm run dev` → http://localhost:5173

## Verify (Phase 0 smoke test)
- Visit `/` → "Sign in with Google" → complete OAuth → lands on `/dashboard`.
- `GET /api/centrifugo-token` (while logged in) returns `{ token }`;
  cross-origin `Origin` header → 403.
- Subscribe to channel `test:ping` in the browser, then
  `POST /api/broadcast {"channel":"test:ping","data":{"hi":1}}` → message received.

## Scripts
- `npm run dev` — dev server
- `npm run build` / `npm run preview` — production build
- `npm run check` — svelte-check typecheck
- `npm run centrifugo` — run Centrifugo from `centrifugo/config.json`
