import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { transcribeAndTranslate } from './groq-client.js';
import { TokenProcessor } from './process-tokens.js';
import { snapshot } from './metrics.js';
import type { ConnectionContext, SessionConfig } from './types.js';

const anon = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

interface StartFrame {
  type: 'start';
  token?: string; // Supabase access token (absent for guests)
  sessionId: string;
  participantId: string;
}

// Mirror of $lib/server/session-expiry.ts's isExpired — duplicated because this
// is a separate deployable (Node package) that can't import SvelteKit aliases.
function isExpired(status: string, expiresAt: string | null): boolean {
  return status === 'active' && !!expiresAt && new Date(expiresAt) <= new Date();
}

// Validate the caller belongs to the session, then load its config + encryption key ref.
async function authorize(frame: StartFrame): Promise<{ ctx: ConnectionContext; expiresAt: string | null }> {
  const { data: participant } = await admin
    .from('session_participants')
    .select('id, user_id, session_id, status, guest_name')
    .eq('id', frame.participantId)
    .eq('session_id', frame.sessionId)
    .single();
  if (!participant || participant.status === 'rejected') throw new Error('not a session participant');

  // Authed participants must present a token whose user matches the participant row.
  let profileName: string | null = null;
  if (participant.user_id) {
    if (!frame.token) throw new Error('token required');
    const { data, error } = await anon.auth.getUser(frame.token);
    if (error || data.user?.id !== participant.user_id) throw new Error('token/participant mismatch');

    const { data: profile } = await admin.from('users').select('name, email').eq('id', participant.user_id).single();
    profileName = profile?.name ?? profile?.email ?? null;
  }

  const { data: session } = await admin
    .from('sessions')
    .select(
      'id, status, mode, no_translation, no_record, source_language, target_language, language_a, language_b, encryption_key_ref, expires_at'
    )
    .eq('id', frame.sessionId)
    .single();
  if (!session || session.status !== 'active' || isExpired(session.status, session.expires_at)) {
    throw new Error('session not active');
  }

  const cfg: SessionConfig = session as unknown as SessionConfig;
  return {
    ctx: {
      sessionId: session.id,
      participantId: participant.id,
      speakerName: participant.guest_name ?? profileName ?? 'Guest',
      encryptionKeyRef: session.encryption_key_ref,
      config: cfg
    },
    expiresAt: session.expires_at
  };
}

const wss = new WebSocketServer({ port: config.port, path: '/realtime' });

wss.on('connection', (ws: WebSocket) => {
  let ctx: ConnectionContext | null = null;
  let processor: TokenProcessor | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  ws.on('close', () => {
    if (expiryTimer) clearTimeout(expiryTimer);
  });

  ws.on('message', async (data: Buffer, isBinary: boolean) => {
    if (!isBinary && !ctx) {
      // First text frame must be the start/control frame.
      try {
        const frame = JSON.parse(data.toString()) as StartFrame;
        if (frame.type !== 'start') return;
        const authorized = await authorize(frame);
        ctx = authorized.ctx;
        processor = new TokenProcessor(ctx);
        ws.send(JSON.stringify({ type: 'ready' }));

        // Enforce the session's duration limit by force-closing at expiry —
        // a long-lived WS connection would otherwise outlive it unnoticed.
        if (authorized.expiresAt) {
          const ms = new Date(authorized.expiresAt).getTime() - Date.now();
          expiryTimer = setTimeout(async () => {
            ws.send(JSON.stringify({ type: 'error', message: 'session time limit reached' }));
            ws.close();
            await admin.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', ctx!.sessionId);
          }, Math.max(ms, 0));
        }
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
        ws.close();
      }
      return;
    }

    // Each binary message is one complete, self-contained audio clip (client
    // records fixed-length segments — Groq's REST API has no persistent stream).
    if (isBinary && ctx && processor) {
      try {
        const tok = await transcribeAndTranslate(data, ctx.config, ctx.participantId, ctx.speakerName);
        if (tok) processor.handleToken(tok);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
      }
    }
  });
});

// Push metrics to the SvelteKit health endpoint (feeds Phase 6 queue-health).
setInterval(() => {
  fetch(`${config.appOrigin}/api/internal/realtime-health/realtime_server`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': config.centrifugoApiKey },
    body: JSON.stringify(snapshot())
  }).catch(() => {});
}, 5000);

console.log(`[realtime-server] listening ws://localhost:${config.port}/realtime`);
