import { describe, it, expect } from 'vitest';
import { chunkTranscript, formatTranscript, CHUNK_CHAR_BUDGET } from './chunk';
import type { TranscriptEntry } from './types';

const entry = (text: string): TranscriptEntry => ({ speakerName: 'A', lang: 'en', text, translations: {} });

describe('chunkTranscript', () => {
  it('keeps everything in one chunk when under budget', () => {
    const chunks = chunkTranscript([entry('hi'), entry('there')]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(2);
  });

  it('splits into multiple chunks when exceeding the char budget', () => {
    const big = 'x'.repeat(CHUNK_CHAR_BUDGET - 10);
    const chunks = chunkTranscript([entry(big), entry(big), entry(big)]);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('never splits a single entry across chunks', () => {
    const big = 'x'.repeat(CHUNK_CHAR_BUDGET + 1000);
    const chunks = chunkTranscript([entry(big)]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1);
  });

  it('returns empty array for no entries', () => {
    expect(chunkTranscript([])).toEqual([]);
  });
});

describe('formatTranscript', () => {
  it('includes translation when present', () => {
    const e: TranscriptEntry = { speakerName: 'A', lang: 'en', text: 'hello', translations: { vi: 'xin chào' } };
    expect(formatTranscript([e])).toContain('xin chào');
  });
});
