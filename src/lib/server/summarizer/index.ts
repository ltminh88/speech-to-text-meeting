import { env } from '$env/dynamic/private';
import { chunkTranscript } from './chunk';
import { createOpenAIAdapter } from './openai';
import { createGeminiAdapter } from './gemini';
import type { Minutes, SummarizerAdapter, TranscriptEntry } from './types';

function resolveAdapter(): SummarizerAdapter {
  const provider = env.SUMMARIZER_PROVIDER || (env.GEMINI_API_KEY ? 'gemini' : env.OPENAI_API_KEY ? 'openai' : '');
  if (provider === 'gemini') return createGeminiAdapter();
  if (provider === 'openai') return createOpenAIAdapter();
  throw new Error('No summarizer provider configured — set OPENAI_API_KEY or GEMINI_API_KEY');
}

/**
 * Map-reduce: summarize each chunk independently (parallel), then merge into
 * one final result. Skips the reduce call entirely for a single chunk — the
 * common case — to save a request. `adapter` is injectable for tests.
 */
export async function summarizeTranscript(
  entries: TranscriptEntry[],
  targetLanguage = 'vi',
  adapter: SummarizerAdapter = resolveAdapter()
): Promise<Minutes> {
  const chunks = chunkTranscript(entries);
  if (chunks.length === 0) return { summary: '', actionItems: [], decisions: [] };

  const parts = await Promise.all(chunks.map((c) => adapter.summarizeChunk(c, targetLanguage)));
  if (parts.length === 1) return parts[0];
  return adapter.reduce(parts, targetLanguage);
}
