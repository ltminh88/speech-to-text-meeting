import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { SonioxClient } from './soniox-client.js';
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

// Validate the caller belongs to the session, then load its config + encryption key ref.
async function authorize(frame: StartFrame): Promise<ConnectionContext> {
  const { data: participant } = await admin
    .from('session_participants')
    .select('id, user_id, session_id, status')
    .eq('id', frame.participantId)
    .eq('session_id', frame.sessionId)
    .single();
  if (!participant || participant.status === 'rejected') throw new Error('not a session participant');

  // Authed participants must present a token whose user matches the participant row.
  if (participant.user_id) {
    if (!frame.token) throw new Error('token required');
    const { data, error } = await anon.auth.getUser(frame.token);
    if (error || data.user?.id !== participant.user_id) throw new Error('token/participant mismatch');
  }

  const { data: session } = await admin
    .from('sessions')
    .select('id, status, mode, no_translation, no_record, source_language, target_language, language_a, language_b, encryption_key_ref')
    .eq('id', frame.sessionId)
    .single();
  if (!session || session.status !== 'active') throw new Error('session not active');

  const cfg: SessionConfig = session as unknown as SessionConfig;
  return { sessionId: session.id, participantId: participant.id, encryptionKeyRef: session.encryption_key_ref, config: cfg };
}

const wss = new WebSocketServer({ port: config.port, path: '/realtime' });

wss.on('connection', (ws: WebSocket) => {
  let soniox: SonioxClient | null = null;

  ws.on('message', async (data: Buffer, isBinary: boolean) => {
    if (!isBinary && !soniox) {
      // First text frame must be the start/control frame.
      try {
        const frame = JSON.parse(data.toString()) as StartFrame;
        if (frame.type !== 'start') return;
        const ctx = await authorize(frame);
        const processor = new TokenProcessor(ctx);
        soniox = new SonioxClient(
          ctx.config,
          (tok) => processor.handleToken(tok),
          (err) => ws.send(JSON.stringify({ type: 'error', message: err.message }))
        );
        ws.send(JSON.stringify({ type: 'ready' }));
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: (err as Error).message }));
        ws.close();
      }
      return;
    }
    if (isBinary && soniox) soniox.sendAudio(data); // audio frame → Soniox (never stored)
  });

  ws.on('close', () => soniox?.close());
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
