import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from './crypto';
import type { StoredSegment } from '$lib/realtime/caption-types';

// Shared by the transcript-history endpoint (caption panel) and the minutes
// endpoint (summarizer input) — one decrypt path, ordered by arrival.
export async function loadTranscriptSegments(
  supabase: SupabaseClient,
  sessionId: string,
  keyRef: string
): Promise<StoredSegment[]> {
  const { data, error } = await supabase
    .from('transcript_segments')
    .select('participant_id, speaker_id, speaker_name, sequence_number, lang, text_encrypted')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const parsed = JSON.parse(decrypt(row.text_encrypted, keyRef)) as {
      text: string;
      translations: Record<string, string>;
    };
    return {
      participantId: row.participant_id ?? '',
      speakerId: row.speaker_id ?? '',
      speakerName: row.speaker_name ?? 'Speaker',
      sequenceNumber: row.sequence_number,
      lang: row.lang ?? '',
      text: parsed.text,
      translations: parsed.translations ?? {}
    };
  });
}
