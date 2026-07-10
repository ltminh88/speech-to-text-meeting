import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin';
import { loadTranscriptSegments } from '$lib/server/transcript';
import { summarizeTranscript } from '$lib/server/summarizer';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

async function loadSession(supabase: SupabaseClient, id: string) {
  const { data, error: sErr } = await supabase
    .from('sessions')
    .select('id, host_id, no_record, encryption_key_ref')
    .eq('id', id)
    .single();
  if (sErr || !data) throw error(404, 'session not found');
  return data;
}

// Cached minutes (avoids recomputing on every page visit).
export const GET: RequestHandler = async ({ params, locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');
  const { data } = await supabase.from('session_minutes').select('content, generated_at').eq('session_id', params.id).single();
  return json({ minutes: data?.content ?? null, generatedAt: data?.generated_at ?? null });
};

// Host-only: (re)generate minutes from the stored transcript.
export const POST: RequestHandler = async ({ params, locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');
  const session = await loadSession(supabase, params.id);
  if (session.host_id !== user.id) throw error(403, 'only the host can generate minutes');

  const segments = await loadTranscriptSegments(supabase, session.id, session.encryption_key_ref);
  const entries = segments.map(({ speakerName, lang, text, translations }) => ({ speakerName, lang, text, translations }));
  if (entries.length === 0) {
    const message = session.no_record ? 'No-record session — no transcript was stored.' : 'No transcript yet.';
    return json({ minutes: null, generatedAt: null, message });
  }

  const minutes = await summarizeTranscript(entries, 'vi');
  const generatedAt = new Date().toISOString();
  await supabaseAdmin.from('session_minutes').upsert({ session_id: session.id, content: minutes, generated_at: generatedAt });

  return json({ minutes, generatedAt });
};
