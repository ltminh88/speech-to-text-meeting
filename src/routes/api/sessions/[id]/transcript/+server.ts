import { json, error } from '@sveltejs/kit';
import { loadTranscriptSegments } from '$lib/server/transcript';
import type { RequestHandler } from './$types';

// Full transcript history for the caption panel — so leaving and rejoining a
// session (or just refreshing) doesn't lose what was already captured, unlike
// the live-only Centrifugo feed. Uses the caller's RLS-scoped client, so only
// session members (host or approved participants) ever see rows.
export const GET: RequestHandler = async ({ params, locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');

  const { data: session, error: sErr } = await supabase
    .from('sessions')
    .select('encryption_key_ref')
    .eq('id', params.id)
    .single();
  if (sErr || !session) throw error(404, 'session not found');

  const segments = await loadTranscriptSegments(supabase, params.id, session.encryption_key_ref);
  return json({ segments });
};
