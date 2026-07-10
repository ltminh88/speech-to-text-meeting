import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/admin';
import type { RequestHandler } from './$types';

// Join a session by id. Authed users join as themselves; guests get a server-minted
// participant row with user_id = null. Admin client used so guests (no RLS identity) work.
export const POST: RequestHandler = async ({ params, request, locals: { user } }) => {
  const { data: session, error: sErr } = await supabaseAdmin
    .from('sessions')
    .select('id, status, mode, no_translation, no_record, source_language, target_language, language_a, language_b')
    .eq('id', params.id)
    .single();
  if (sErr || !session) throw error(404, 'session not found');
  if (session.status !== 'active') throw error(409, 'session has ended');

  let guestName: string | null = null;
  if (!user) {
    const body = await request.json().catch(() => ({}));
    guestName = (body.guestName ?? 'Guest').toString().slice(0, 60);
  }

  const { data: participant, error: pErr } = await supabaseAdmin
    .from('session_participants')
    .upsert(
      {
        session_id: session.id,
        user_id: user?.id ?? null,
        guest_name: guestName,
        role: 'participant',
        status: 'active',
        joined_at: new Date().toISOString()
      },
      { onConflict: 'session_id,user_id', ignoreDuplicates: false }
    )
    .select()
    .single();
  if (pErr) throw error(500, pErr.message);

  return json({ participantId: participant.id, session });
};
