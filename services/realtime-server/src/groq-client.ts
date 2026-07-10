import { config } from './config.js';
import type { AsrToken, SessionConfig } from './types.js';

// English names read more reliably in a translation prompt than raw ISO codes.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ja: 'Japanese',
  vi: 'Vietnamese',
  ko: 'Korean',
  zh: 'Chinese',
  fr: 'French',
  es: 'Spanish'
};

function langName(code: string | null): string {
  return (code && LANGUAGE_NAMES[code]) || code || 'the target language';
}

// Which language to translate INTO, given the mode and what Whisper detected as spoken.
function resolveTargetLang(cfg: SessionConfig, detectedLang: string): string | null {
  if (cfg.mode === 'none' || cfg.no_translation) return null;
  if (cfg.mode === 'one_way') return cfg.target_language;
  // two_way: translate into whichever of language_a/language_b was NOT the detected one.
  if (cfg.mode === 'two_way') {
    if (detectedLang === cfg.language_a) return cfg.language_b;
    if (detectedLang === cfg.language_b) return cfg.language_a;
    return cfg.language_b; // detection ambiguous — default to B
  }
  return null;
}

interface WhisperResponse {
  text: string;
  language?: string;
}

async function transcribe(audio: Buffer): Promise<WhisperResponse> {
  const form = new FormData();
  const ab = new ArrayBuffer(audio.byteLength);
  new Uint8Array(ab).set(audio);
  form.append('file', new Blob([ab], { type: 'audio/webm' }), 'segment.webm');
  form.append('model', config.groqSttModel);
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqApiKey}` },
    body: form
  });
  if (!res.ok) throw new Error(`groq transcription ${res.status}: ${await res.text()}`);
  return (await res.json()) as WhisperResponse;
}

async function translate(text: string, targetLang: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.groqApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.groqLlmModel,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: `You are a professional interpreter. Translate the user's message into ${langName(targetLang)}. Output ONLY the translation — no notes, no original text, no quotes.`
        },
        { role: 'user', content: text }
      ]
    })
  });
  if (!res.ok) throw new Error(`groq translation ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * Transcribe one self-contained audio segment (Whisper) and, if the session's
 * translation mode requires it, translate the result (Llama). Always returns a
 * single "final" token — Groq's REST API has no partial/live tokens like Soniox.
 */
export async function transcribeAndTranslate(
  audio: Buffer,
  cfg: SessionConfig,
  speakerId: string,
  speakerName: string
): Promise<AsrToken | null> {
  const { text, language } = await transcribe(audio);
  const trimmed = text.trim();
  if (!trimmed) return null; // silence / no speech in this segment

  const lang = language ?? cfg.source_language ?? cfg.language_a ?? 'en';
  const targetLang = resolveTargetLang(cfg, lang);

  const translations: Record<string, string> = {};
  if (targetLang) {
    const translated = await translate(trimmed, targetLang);
    if (translated) translations[targetLang] = translated;
  }

  return { text: trimmed, translations, isFinal: true, speakerId, speakerName, lang };
}
