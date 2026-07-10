# speech-to-text-meeting

Real-time speech translation & meeting-minutes app. Speak in one language,
see live captions translated into another (e.g. English → Vietnamese), then
generate an AI summary of the meeting afterwards.

Rebuilt from scratch (SvelteKit + Supabase + Centrifugo + Groq) — no prior
experience with this repo needed. This guide assumes you're starting cold.

## What you're setting up

Three things run locally at the same time:

| Service | What it does | Port |
|---|---|---|
| **Web app** | The SvelteKit UI (login, dashboard, meeting room) | 5173 |
| **realtime-server** | Sends your mic audio to Groq for transcription + translation | 3001 |
| **Centrifugo** | Pushes live captions to everyone in the meeting | 8000 |

Plus two things hosted elsewhere for free: **Supabase** (database + login)
and **Groq** (speech-to-text + translation).

## 1. Install prerequisites

- **Node.js 20+** — https://nodejs.org (or `brew install node` on macOS)
- **Podman** — https://podman.io/docs/installation (or `brew install podman`
  on macOS, then run `podman machine init && podman machine start` once)
- A free **Supabase** account — https://supabase.com
- A free **Groq** account — https://console.groq.com

## 2. Get the code running

```bash
git clone https://github.com/ltminh88/speech-to-text-meeting.git
cd speech-to-text-meeting
npm install
cd services/realtime-server && npm install && cd ../..
```

## 3. Create your Supabase project

1. Go to https://supabase.com/dashboard → **New project**. Save the
   database password somewhere (you likely won't need it again).
2. Once created, go to **Settings → API**. You'll need three values from
   this page for the next step:
   - **Project URL**
   - **anon / publishable key**
   - **service_role / secret key** (click "Reveal") — keep this one private

## 4. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `PUBLIC_SUPABASE_URL` | Supabase → Settings → API → "Project URL" |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role/secret key |
| `GROQ_API_KEY` | https://console.groq.com/keys → Create API Key |
| `GEMINI_API_KEY` (optional) | https://aistudio.google.com/apikey — only needed for the "Generate meeting minutes" feature |
| `TRANSCRIPT_MASTER_KEY` | Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `CENTRIFUGO_HMAC_SECRET` / `CENTRIFUGO_API_KEY` | Make up any long random strings — just keep them consistent |

Everything else in `.env.example` already has a working default for local use.

## 5. Set up the database

1. In your Supabase project, open the **SQL Editor**.
2. Open each file in `supabase/migrations/` **in order** (0001, 0002, 0003,
   0004, 0005), paste its contents, and click **Run**.

## 6. Enable Google login

1. In Supabase: **Authentication → Sign In / Providers → Google** → toggle
   **Enable**.
2. You need a Google OAuth Client ID/Secret for this — see
   [Google's guide](https://developers.google.com/identity/protocols/oauth2)
   if you don't have one. Authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Paste the Client ID + Secret into Supabase and **Save**.
4. Still in Supabase Authentication settings, set **Site URL** to
   `http://localhost:5173` and add `http://localhost:5173/**` to the
   **Redirect URLs** allow list.

## 7. Run it

```bash
./scripts/meeting-translate up
```

This starts all three services in the background. Wait a couple of
seconds, then open **http://localhost:5173**, sign in with Google, and
create a session.

To stop everything:

```bash
./scripts/meeting-translate down
```

Logs while running: `/tmp/stt-meeting-web.log` and
`/tmp/stt-meeting-realtime.log`.

## Troubleshooting

- **"Start speaking" does nothing / mic permission never appears** —
  browsers only allow microphone access on `localhost` or HTTPS. This is a
  hard browser rule, not a bug — if you ever deploy this somewhere with a
  public IP, you'll need a domain + SSL certificate for the mic to work.
- **`meeting-translate up` fails with a Podman error mentioning "no such
  file or directory"** — a leftover Centrifugo container from a previous
  folder location. Fix: `podman rm -f mp-centrifugo` then run
  `./scripts/meeting-translate up` again.
- **Podman commands hang or fail on macOS** — the Podman VM isn't running:
  `podman machine start`.
- **Port already in use** — something's already running;
  `./scripts/meeting-translate down` first, then try again.

## Project structure

```
src/                        SvelteKit app (UI + API routes)
services/realtime-server/   Node WebSocket service (audio → Groq → captions)
supabase/migrations/        Database schema, in numbered order
centrifugo/                 Centrifugo config for local Podman
scripts/                    meeting-translate up|down convenience script
plans/                      Full technical plan + phase-by-phase design notes
```

## Stack

- **SvelteKit** (SSR + CSR), Tailwind — `adapter-node`
- **Supabase** (Postgres + Google OAuth + RLS)
- **Centrifugo** (self-host) — realtime captions pub/sub
- **Groq** — Whisper transcription + Llama translation, ~4s audio segments
- **Gemini / OpenAI** — on-demand meeting-minutes summarization

## npm scripts

- `npm run dev` / `npm run build` / `npm run preview` — SvelteKit dev/build/preview
- `npm run check` — typecheck
- `npm test` — unit tests
- `npm run centrifugo` — run Centrifugo as a bare binary instead of Podman

## Deeper technical detail

The full phase-by-phase implementation plan (architecture decisions,
schema, RLS design, realtime pipeline internals) lives in
`plans/260710-0846-meet-plus-rebuild/plan.md`.
