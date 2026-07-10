import type { TranscriptEntry } from './types';

// Char count as a token-budget proxy — simple and dependency-free, with enough
// headroom below real context limits that the approximation never matters.
export const CHUNK_CHAR_BUDGET = 8000;

function formatEntry(e: TranscriptEntry): string {
  const translated = Object.values(e.translations)[0];
  return `${e.speakerName} (${e.lang}): ${e.text}${translated ? ` → ${translated}` : ''}`;
}

// Split transcript entries into budgeted chunks without ever splitting a
// single entry across two chunks, so each chunk stays internally coherent.
export function chunkTranscript(entries: TranscriptEntry[]): TranscriptEntry[][] {
  const chunks: TranscriptEntry[][] = [];
  let current: TranscriptEntry[] = [];
  let currentLen = 0;

  for (const entry of entries) {
    const len = formatEntry(entry).length;
    if (currentLen + len > CHUNK_CHAR_BUDGET && current.length) {
      chunks.push(current);
      current = [];
      currentLen = 0;
    }
    current.push(entry);
    currentLen += len;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

export function formatTranscript(entries: TranscriptEntry[]): string {
  return entries.map(formatEntry).join('\n');
}
