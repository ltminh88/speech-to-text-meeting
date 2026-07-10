import WebSocket from 'ws';
import { config } from './config.js';
import type { SessionConfig, SonioxToken } from './types.js';

// Thin wrapper over Soniox's realtime STT+translation WebSocket.
// NOTE: Soniox's `translation` config mirrors our modes (one_way/two_way) — see strategy §2.
// Exact token field names are validated against the live API (carry-in Q1: context terms).

function buildRequest(cfg: SessionConfig, contextTerms: string[] = []) {
  const req: Record<string, unknown> = {
    api_key: config.sonioxApiKey,
    model: 'stt-rt-preview',
    audio_format: 'auto',
    enable_speaker_diarization: true,
    enable_endpoint_detection: true
  };
  if (cfg.mode === 'one_way' && cfg.source_language && cfg.target_language) {
    req.language_hints = [cfg.source_language];
    req.translation = { type: 'one_way', target_language: cfg.target_language };
  } else if (cfg.mode === 'two_way' && cfg.language_a && cfg.language_b) {
    req.language_hints = [cfg.language_a, cfg.language_b];
    req.translation = { type: 'two_way', language_a: cfg.language_a, language_b: cfg.language_b };
  }
  if (contextTerms.length) req.context = { terms: contextTerms }; // Phase 5 (Q1)
  return req;
}

export class SonioxClient {
  private ws: WebSocket;
  private ready = false;
  private pending: Buffer[] = [];

  constructor(
    private cfg: SessionConfig,
    private onToken: (tok: SonioxToken) => void,
    private onError: (err: Error) => void,
    contextTerms: string[] = []
  ) {
    this.ws = new WebSocket(config.sonioxWsUrl);
    this.ws.on('open', () => {
      this.ws.send(JSON.stringify(buildRequest(cfg, contextTerms)));
      this.ready = true;
      this.pending.forEach((b) => this.ws.send(b));
      this.pending = [];
    });
    this.ws.on('message', (raw) => this.parse(raw.toString()));
    this.ws.on('error', (e) => this.onError(e as Error));
  }

  sendAudio(chunk: Buffer): void {
    if (this.ready) {
      // Backpressure guard: if Soniox is draining slowly, drop the frame instead of OOMing.
      if (this.ws.bufferedAmount > config.maxAudioQueue * 8192) return;
      this.ws.send(chunk);
    } else {
      if (this.pending.length >= config.maxAudioQueue) this.pending.shift();
      this.pending.push(chunk);
    }
  }

  close(): void {
    try {
      if (this.ready) this.ws.send(JSON.stringify({ type: 'finalize' }));
      this.ws.close();
    } catch {
      /* already closed */
    }
  }

  // Group Soniox tokens into one normalized segment: original text + translations by language.
  private parse(raw: string): void {
    let msg: { tokens?: SonioxToken_[] };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg.tokens?.length) return;

    let original = '';
    const translations: Record<string, string> = {};
    let isFinal = false;
    let speakerId = '';
    let lang = this.cfg.source_language ?? this.cfg.language_a ?? '';

    for (const t of msg.tokens) {
      if (t.is_final) isFinal = true;
      if (t.speaker) speakerId = String(t.speaker);
      if (t.translation_status === 'translation') {
        const l = t.language ?? 'xx';
        translations[l] = (translations[l] ?? '') + t.text;
      } else {
        original += t.text;
        if (t.language) lang = t.language;
      }
    }

    this.onToken({
      text: original,
      translations,
      isFinal,
      speakerId,
      speakerName: speakerId ? `Speaker ${speakerId}` : '',
      lang
    });
  }
}

// Raw Soniox token shape (subset used here).
interface SonioxToken_ {
  text: string;
  is_final?: boolean;
  speaker?: string | number;
  language?: string;
  translation_status?: 'original' | 'translation' | 'none';
}
