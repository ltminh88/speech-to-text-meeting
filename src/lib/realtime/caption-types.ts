// Caption event contract — byte-compatible with the original bundle payload
// (strategy §2). Shared by the client caption store and the realtime_server builder.

export type CaptionEventName = 'caption' | 'caption_final';

export interface CaptionPayload {
  text: string;
  translations: Record<string, string>; // { "<lang>": "<translated text>" }
  isFinal: boolean;
  participantId: string;
  sequenceNumber: number;
  speakerId: string;
  speakerName: string;
  lang: string;
}

export interface CaptionEvent {
  event: CaptionEventName;
  payload: CaptionPayload;
}

// A persisted transcript row, shaped identically to CaptionPayload minus isFinal
// (stored rows are always final) — lets the client turn history straight into
// CaptionPayload objects with a single `{ ...seg, isFinal: true }`.
export type StoredSegment = Omit<CaptionPayload, 'isFinal'>;

// Client display rule (from bundle): show the first available translation, else source text.
export function displayText(p: CaptionPayload): string {
  const first = Object.keys(p.translations)[0];
  return first ? p.translations[first] : p.text;
}
