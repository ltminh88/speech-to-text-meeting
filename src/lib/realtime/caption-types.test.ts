import { describe, it, expect } from 'vitest';
import { displayText } from './caption-types';
import type { CaptionPayload } from './caption-types';

const base: CaptionPayload = {
  text: 'hello',
  translations: {},
  isFinal: true,
  participantId: 'p',
  sequenceNumber: 1,
  speakerId: '1',
  speakerName: 'Speaker 1',
  lang: 'en'
};

describe('displayText', () => {
  it('shows first translation when present', () => {
    expect(displayText({ ...base, translations: { ja: 'こんにちは' } })).toBe('こんにちは');
  });
  it('falls back to source text when no translation', () => {
    expect(displayText(base)).toBe('hello');
  });
});
