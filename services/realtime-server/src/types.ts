// Local mirror of src/lib/realtime/caption-types.ts (separate package, kept byte-compatible).

export type CaptionEventName = 'caption' | 'caption_final';

export interface CaptionPayload {
  text: string;
  translations: Record<string, string>;
  isFinal: boolean;
  participantId: string;
  sequenceNumber: number;
  speakerId: string;
  speakerName: string;
  lang: string;
}

export type TranslationMode = 'none' | 'one_way' | 'two_way';

export interface SessionConfig {
  mode: TranslationMode;
  no_translation: boolean;
  no_record: boolean;
  source_language: string | null;
  target_language: string | null;
  language_a: string | null;
  language_b: string | null;
}

// Normalized token emitted by the Soniox client wrapper.
export interface SonioxToken {
  text: string;
  isFinal: boolean;
  speakerId: string;
  speakerName: string;
  lang: string;
  translations: Record<string, string>;
}

export interface ConnectionContext {
  sessionId: string;
  participantId: string;
  encryptionKeyRef: string;
  config: SessionConfig;
}
