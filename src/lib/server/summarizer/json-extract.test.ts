import { describe, it, expect } from 'vitest';
import { extractJson } from './json-extract';

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences with language tag', () => {
    expect(extractJson<{ a: number }>('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips fences without a language tag', () => {
    expect(extractJson<{ a: number }>('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
