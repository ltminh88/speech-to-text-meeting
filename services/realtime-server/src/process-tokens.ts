import { broadcastCaption } from './broadcast.js';
import { saveTranscript } from './save-transcript.js';
import { recordFinal, recordTokenProcess } from './metrics.js';
import type { CaptionPayload, ConnectionContext, AsrToken } from './types.js';

// Monotonic sequence per session (multi-speaker safe). Cleared when a session drains.
const sessionSeq = new Map<string, number>();
function nextSeq(sessionId: string): number {
  const n = (sessionSeq.get(sessionId) ?? 0) + 1;
  sessionSeq.set(sessionId, n);
  return n;
}
export function resetSession(sessionId: string) {
  sessionSeq.delete(sessionId);
}

/**
 * Buffers partial tokens and, on a final token, flushes. With Groq (REST, no
 * partial/live tokens) every call is final — the partial branch below is dead
 * code today but kept so a future streaming-capable ASR can plug in unchanged.
 * Dispatch to DB save + Centrifugo broadcast is FIRE-AND-FORGET — never awaited —
 * so a slow DB write cannot stall live captions (core design invariant, strategy §2).
 */
export class TokenProcessor {
  private partial = '';
  constructor(private ctx: ConnectionContext) {}

  handleToken(tok: AsrToken): void {
    const start = performance.now();

    if (tok.isFinal) {
      this.partial = '';
      const payload = this.buildPayload(tok, true);
      const hasTranslation = Object.keys(payload.translations).length > 0;
      recordFinal(this.ctx.config.mode === 'none' ? true : hasTranslation);

      // (A) persist + (B) broadcast, concurrently, without awaiting.
      void saveTranscript(this.ctx, payload);
      void broadcastCaption(this.ctx.sessionId, 'caption_final', payload);
    } else {
      this.partial += tok.text;
      const payload = this.buildPayload({ ...tok, text: this.partial }, false);
      void broadcastCaption(this.ctx.sessionId, 'caption', payload); // partials are never saved
    }

    recordTokenProcess(performance.now() - start);
  }

  private buildPayload(tok: AsrToken, isFinal: boolean): CaptionPayload {
    return {
      text: tok.text,
      translations: tok.translations ?? {},
      isFinal,
      participantId: this.ctx.participantId,
      sequenceNumber: isFinal ? nextSeq(this.ctx.sessionId) : this.peekSeq(),
      speakerId: tok.speakerId,
      speakerName: tok.speakerName,
      lang: tok.lang
    };
  }

  // Partials share the next final's sequence slot (so a partial then its final line up).
  private peekSeq(): number {
    return (sessionSeq.get(this.ctx.sessionId) ?? 0) + 1;
  }
}
