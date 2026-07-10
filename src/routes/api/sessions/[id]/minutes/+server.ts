import { json, error } from '@sveltejs/kit';
import { decrypt } from '$lib/server/crypto';
import { supabaseAdmin } from '$lib/server/admin';
import { summarizeTranscript } from '$lib/server/summarizer';
import type { TranscriptEntry } from '$lib/server/summarizer/types';
import type { RequestHandler } from './$types';

async function loadSession(id: string) {
  const { data, error: sErr } = await supabaseAdmin
    .from('sessions')
    .select('id, host_id, no_record, encryption_key_ref')
    .eq('id', id)
    .single();
  if (sErr || !data) throw error(404, 'session not found');
  return data;
}

async function loadTranscript(sessionId: string, keyRef: string): Promise<TranscriptEntry[]> {
  const { data, error: tErr } = await supabaseAdmin
    .from('transcript_segments')
    .select('speaker_name, lang, text_encrypted')
    .eq('session_id', sessionId)
    .order('sequence_number', { ascending: true });
  if (tErr) throw error(500, tErr.message);

  return (data ?? []).map((row) => {
    const parsed = JSON.parse(decrypt(row.text_encrypted, keyRef)) as {
      text: string;
      translations: Record<string, string>;
    };
    return { speakerName: row.speaker_name ?? 'Speaker', lang: row.lang ?? '', text: parsed.text, translations: parsed.translations ?? {} };
  });
}

// Cached minutes (avoids recomputing on every page visit).
export const GET: RequestHandler = async ({ params, locals: { user } }) => {
  if (!user) throw error(401, 'auth required');
  const { data } = await supabaseAdmin.from('session_minutes').select('content, generated_at').eq('session_id', params.id).single();
  return json({ minutes: data?.content ?? null, generatedAt: data?.generated_at ?? null });
};

// Host-only: (re)generate minutes from the stored transcript.
export const POST: RequestHandler = async ({ params, locals: { user } }) => {
  if (!user) throw error(401, 'auth required');
  const session = await loadSession(params.id);
  if (session.host_id !== user.id) throw error(403, 'only the host can generate minutes');

  const entries = await loadTranscript(session.id, session.encryption_key_ref);
  if (entries.length === 0) {
    const message = session.no_record ? 'No-record session — no transcript was stored.' : 'No transcript yet.';
    return json({ minutes: null, generatedAt: null, message });
  }

  const minutes = await summarizeTranscript(entries, 'vi');
  const generatedAt = new Date().toISOString();
  await supabaseAdmin.from('session_minutes').upsert({ session_id: session.id, content: minutes, generated_at: generatedAt });

  return json({ minutes, generatedAt });
};
