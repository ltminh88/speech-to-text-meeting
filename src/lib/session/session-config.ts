// Shared session translation config — single source of truth for server + form (DRY).

export const TRANSLATION_MODES = ['none', 'one_way', 'two_way'] as const;
export type TranslationMode = (typeof TRANSLATION_MODES)[number];

export interface SessionConfig {
  mode: TranslationMode;
  no_translation: boolean;
  no_record: boolean;
  source_language: string | null;
  target_language: string | null;
  language_a: string | null;
  language_b: string | null;
}

// Common language codes offered in the picker (extend freely).
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' }
] as const;

export type ValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Validate a mode↔language combination.
 * - none:    transcription only, no target languages.
 * - one_way: source_language → target_language.
 * - two_way: language_a ↔ language_b (bilingual conversation).
 */
export function validateSessionConfig(c: Partial<SessionConfig>): ValidationResult {
  if (!c.mode || !TRANSLATION_MODES.includes(c.mode)) {
    return { ok: false, error: 'invalid mode' };
  }

  if (c.mode === 'none') {
    return { ok: true };
  }

  if (c.mode === 'one_way') {
    if (!c.source_language || !c.target_language) {
      return { ok: false, error: 'one_way requires source_language and target_language' };
    }
    if (c.source_language === c.target_language) {
      return { ok: false, error: 'source and target languages must differ' };
    }
    return { ok: true };
  }

  // two_way
  if (!c.language_a || !c.language_b) {
    return { ok: false, error: 'two_way requires language_a and language_b' };
  }
  if (c.language_a === c.language_b) {
    return { ok: false, error: 'language_a and language_b must differ' };
  }
  return { ok: true };
}

/** Normalize a raw config into DB columns (nulls out languages irrelevant to the mode). */
export function normalizeConfig(c: Partial<SessionConfig>): SessionConfig {
  const base: SessionConfig = {
    mode: (c.mode ?? 'none') as TranslationMode,
    no_translation: c.mode === 'none' ? true : Boolean(c.no_translation),
    no_record: Boolean(c.no_record),
    source_language: null,
    target_language: null,
    language_a: null,
    language_b: null
  };
  if (base.mode === 'one_way') {
    base.source_language = c.source_language ?? null;
    base.target_language = c.target_language ?? null;
  } else if (base.mode === 'two_way') {
    base.language_a = c.language_a ?? null;
    base.language_b = c.language_b ?? null;
  }
  return base;
}
