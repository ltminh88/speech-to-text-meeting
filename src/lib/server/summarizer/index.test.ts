import { describe, it, expect, vi } from 'vitest';
import { summarizeTranscript } from './index';
import { CHUNK_CHAR_BUDGET } from './chunk';
import type { Minutes, SummarizerAdapter, TranscriptEntry } from './types';

function makeAdapter(chunkResult: Minutes, reduceResult?: Minutes): SummarizerAdapter {
  return {
    summarizeChunk: vi.fn(async () => chunkResult),
    reduce: vi.fn(async () => reduceResult ?? chunkResult)
  };
}

const entry = (text: string): TranscriptEntry => ({ speakerName: 'A', lang: 'en', text, translations: {} });

describe('summarizeTranscript map-reduce', () => {
  it('skips reduce when the transcript fits in one chunk', async () => {
    const adapter = makeAdapter({ summary: 's', actionItems: [], decisions: [] });
    await summarizeTranscript([entry('short')], 'vi', adapter);
    expect(adapter.summarizeChunk).toHaveBeenCalledTimes(1);
    expect(adapter.reduce).not.toHaveBeenCalled();
  });

  it('calls reduce when the transcript spans multiple chunks', async () => {
    const big = 'x'.repeat(CHUNK_CHAR_BUDGET);
    const adapter = makeAdapter(
      { summary: 's', actionItems: [], decisions: [] },
      { summary: 'merged', actionItems: [], decisions: [] }
    );
    const result = await summarizeTranscript([entry(big), entry(big)], 'vi', adapter);
    expect(adapter.summarizeChunk).toHaveBeenCalledTimes(2);
    expect(adapter.reduce).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('merged');
  });

  it('returns empty minutes for zero entries without calling the adapter', async () => {
    const adapter = makeAdapter({ summary: 's', actionItems: [], decisions: [] });
    const result = await summarizeTranscript([], 'vi', adapter);
    expect(result).toEqual({ summary: '', actionItems: [], decisions: [] });
    expect(adapter.summarizeChunk).not.toHaveBeenCalled();
  });
});
