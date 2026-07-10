import { describe, it, expect } from 'vitest';
import { validateSessionConfig, normalizeConfig } from './session-config';

describe('validateSessionConfig — mode↔language matrix', () => {
  it('none: always valid, ignores languages', () => {
    expect(validateSessionConfig({ mode: 'none' }).ok).toBe(true);
  });

  it('one_way: requires distinct source+target', () => {
    expect(validateSessionConfig({ mode: 'one_way', source_language: 'en', target_language: 'ja' }).ok).toBe(true);
    expect(validateSessionConfig({ mode: 'one_way', source_language: 'en' }).ok).toBe(false);
    expect(validateSessionConfig({ mode: 'one_way', source_language: 'en', target_language: 'en' }).ok).toBe(false);
  });

  it('two_way: requires distinct A+B', () => {
    expect(validateSessionConfig({ mode: 'two_way', language_a: 'en', language_b: 'vi' }).ok).toBe(true);
    expect(validateSessionConfig({ mode: 'two_way', language_a: 'en' }).ok).toBe(false);
    expect(validateSessionConfig({ mode: 'two_way', language_a: 'en', language_b: 'en' }).ok).toBe(false);
  });

  it('rejects unknown mode', () => {
    expect(validateSessionConfig({ mode: 'garbage' as never }).ok).toBe(false);
  });
});

describe('normalizeConfig — nulls irrelevant languages', () => {
  it('none forces no_translation and clears languages', () => {
    const c = normalizeConfig({ mode: 'none', source_language: 'en', language_a: 'ja' });
    expect(c.no_translation).toBe(true);
    expect(c.source_language).toBeNull();
    expect(c.language_a).toBeNull();
  });

  it('one_way keeps source/target, clears A/B', () => {
    const c = normalizeConfig({ mode: 'one_way', source_language: 'en', target_language: 'ja', language_a: 'x' });
    expect(c.source_language).toBe('en');
    expect(c.target_language).toBe('ja');
    expect(c.language_a).toBeNull();
  });

  it('two_way keeps A/B, clears source/target', () => {
    const c = normalizeConfig({ mode: 'two_way', language_a: 'en', language_b: 'vi', source_language: 'x' });
    expect(c.language_a).toBe('en');
    expect(c.language_b).toBe('vi');
    expect(c.source_language).toBeNull();
  });
});
