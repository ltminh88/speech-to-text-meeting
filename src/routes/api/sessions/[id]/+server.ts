import { json, error } from '@sveltejs/kit';
import { validateSessionConfig, normalizeConfig } from '$lib/session/session-config';
import { decrypt, encrypt } from '$lib/server/crypto';
import type { RequestHandler } from './$types';

// Session config + participants for UI hydration (RLS-scoped read).
export const GET: RequestHandler = async ({ params, locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');

  const { data: s, error: sErr } = await supabase.from('sessions').select('*').eq('id', params.id).single();
  if (sErr || !s) throw error(404, 'session not found');

  const { data: participants } = await supabase
    .from('session_participants')
    .select('id, user_id, guest_name, role, status, muted, joined_at')
    .eq('session_id', params.id);

  return json({
    session: {
      id: s.id,
      status: s.status,
      mode: s.mode,
      no_translation: s.no_translation,
      no_record: s.no_record,
      source_language: s.source_language,
      target_language: s.target_language,
      language_a: s.language_a,
      language_b: s.language_b,
      title: s.title_encrypted ? tryDecrypt(s.title_encrypted, s.encryption_key_ref) : null,
      is_host: s.host_id === user.id,
      started_at: s.started_at,
      ended_at: s.ended_at
    },
    participants: participants ?? []
  });
};

// Host-only: update translation settings, retitle, or end the session.
export const PATCH: RequestHandler = async ({ params, request, locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');
  const body = await request.json();

  const { data: s, error: sErr } = await supabase
    .from('sessions')
    .select('host_id, encryption_key_ref')
    .eq('id', params.id)
    .single();
  if (sErr || !s) throw error(404, 'session not found');
  if (s.host_id !== user.id) throw error(403, 'only the host can modify this session');

  const patch: Record<string, unknown> = {};

  if (body.status === 'ended') {
    patch.status = 'ended';
    patch.ended_at = new Date().toISOString();
  }

  if (body.mode !== undefined) {
    const check = validateSessionConfig(body);
    if (!check.ok) throw error(400, check.error);
    Object.assign(patch, normalizeConfig(body));
  }

  if (typeof body.title === 'string') {
    patch.title_encrypted = body.title ? encrypt(body.title.slice(0, 200), s.encryption_key_ref) : null;
  }

  if (Object.keys(patch).length === 0) throw error(400, 'nothing to update');

  const { error: updErr } = await supabase.from('sessions').update(patch).eq('id', params.id);
  if (updErr) throw error(500, updErr.message);
  return json({ ok: true });
};

function tryDecrypt(payload: string, keyRef: string | null): string | null {
  if (!keyRef) return null;
  try {
    return decrypt(payload, keyRef);
  } catch {
    return null;
  }
}
