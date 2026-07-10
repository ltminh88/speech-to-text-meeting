import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
import { encrypt } from './crypto.js';
import { timed } from './metrics.js';
import type { CaptionPayload, ConnectionContext } from './types.js';

const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const RETRY_DELAYS = [100, 200, 400]; // ms — matches original saveTranscript() backoff.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Persist a final caption (encrypted). Skips entirely in no_record mode.
 * Retries 100/200/400ms (max 3 attempts) then drops with a logged error —
 * NEVER throws to the caller, so it can't stall the fire-and-forget pipeline.
 */
export async function saveTranscript(ctx: ConnectionContext, payload: CaptionPayload): Promise<void> {
  if (ctx.config.no_record) return; // audio & transcript never stored

  const text_encrypted = encrypt(
    JSON.stringify({ text: payload.text, translations: payload.translations }),
    ctx.encryptionKeyRef
  );
  const row = {
    session_id: ctx.sessionId,
    participant_id: ctx.participantId,
    speaker_id: payload.speakerId,
    speaker_name: payload.speakerName,
    sequence_number: payload.sequenceNumber,
    text_encrypted,
    lang: payload.lang,
    is_final: true
  };

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      await timed('dbSave', async () => {
        const { error } = await admin.from('transcript_segments').insert(row);
        if (error) throw new Error(error.message);
      });
      return;
    } catch (err) {
      if (attempt === RETRY_DELAYS.length) {
        console.error(`[save-transcript] dropped seq=${payload.sequenceNumber} after retries:`, err);
        return;
      }
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
}
