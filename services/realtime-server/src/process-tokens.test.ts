import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the two sinks so we test dispatch behavior without config/supabase/env.
vi.mock('./broadcast.js', () => ({ broadcastCaption: vi.fn(async () => {}) }));
vi.mock('./save-transcript.js', () => ({ saveTranscript: vi.fn(async () => {}) }));

import { TokenProcessor, resetSession } from './process-tokens.js';
import { broadcastCaption } from './broadcast.js';
import { saveTranscript } from './save-transcript.js';
import type { ConnectionContext, SonioxToken } from './types.js';

const ctx: ConnectionContext = {
  sessionId: 's1',
  participantId: 'p1',
  encryptionKeyRef: 'ref',
  config: { mode: 'one_way', no_translation: false, no_record: false, source_language: 'en', target_language: 'ja', language_a: null, language_b: null }
};

const partial: SonioxToken = { text: 'hel', isFinal: false, speakerId: '1', speakerName: 'Speaker 1', lang: 'en', translations: {} };
const final: SonioxToken = { text: 'hello', isFinal: true, speakerId: '1', speakerName: 'Speaker 1', lang: 'en', translations: { ja: 'こんにちは' } };

describe('TokenProcessor', () => {
  beforeEach(() => {
    resetSession('s1');
    vi.mocked(broadcastCaption).mockClear();
    vi.mocked(saveTranscript).mockClear();
  });

  it('partial: broadcasts caption, never saves', () => {
    new TokenProcessor(ctx).handleToken(partial);
    expect(broadcastCaption).toHaveBeenCalledWith('s1', 'caption', expect.objectContaining({ isFinal: false }));
    expect(saveTranscript).not.toHaveBeenCalled();
  });

  it('final: saves AND broadcasts caption_final (fire-and-forget)', () => {
    new TokenProcessor(ctx).handleToken(final);
    expect(saveTranscript).toHaveBeenCalledTimes(1);
    expect(broadcastCaption).toHaveBeenCalledWith('s1', 'caption_final', expect.objectContaining({ isFinal: true, sequenceNumber: 1 }));
  });

  it('sequenceNumber is monotonic per session across finals', () => {
    const proc = new TokenProcessor(ctx);
    proc.handleToken(final);
    proc.handleToken(final);
    const seqs = vi.mocked(broadcastCaption).mock.calls
      .filter((c) => c[1] === 'caption_final')
      .map((c) => (c[2] as { sequenceNumber: number }).sequenceNumber);
    expect(seqs).toEqual([1, 2]);
  });

  it('carries translations map through to the payload', () => {
    new TokenProcessor(ctx).handleToken(final);
    const payload = vi.mocked(broadcastCaption).mock.calls.at(-1)?.[2] as { translations: Record<string, string> };
    expect(payload.translations).toEqual({ ja: 'こんにちは' });
  });
});
