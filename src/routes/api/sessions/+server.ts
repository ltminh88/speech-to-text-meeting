import { json, error } from '@sveltejs/kit';
import { validateSessionConfig, normalizeConfig } from '$lib/session/session-config';
import { encrypt, decrypt, newKeyRef } from '$lib/server/crypto';
import { isExpired } from '$lib/server/session-expiry';
import type { RequestHandler } from './$types';

// Create a session (+ host participant). Title is stored encrypted.
// Optional durationMinutes sets a hard time limit (session auto-ends once
// expires_at passes — checked lazily, no background job).
export const POST: RequestHandler = async ({ request, locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');
  const body = await request.json();

  const check = validateSessionConfig(body);
  if (!check.ok) throw error(400, check.error);
  const config = normalizeConfig(body);

  const keyRef = newKeyRef();
  const title: string = (body.title ?? '').toString().slice(0, 200);
  const durationMinutes: number | null =
    typeof body.durationMinutes === 'number' && Number.isFinite(body.durationMinutes) && body.durationMinutes > 0
      ? body.durationMinutes
      : null;
  const expires_at = durationMinutes ? new Date(Date.now() + durationMinutes * 60_000).toISOString() : null;

  const { data: session, error: insErr } = await supabase
    .from('sessions')
    .insert({
      host_id: user.id,
      ...config,
      title_encrypted: title ? encrypt(title, keyRef) : null,
      encryption_key_ref: keyRef,
      expires_at
    })
    .select()
    .single();
  if (insErr) throw error(500, insErr.message);

  const { error: partErr } = await supabase
    .from('session_participants')
    .insert({ session_id: session.id, user_id: user.id, role: 'host', status: 'active', joined_at: new Date().toISOString() });
  if (partErr) throw error(500, partErr.message);

  return json({ sessionId: session.id }, { status: 201 });
};

// List sessions the caller can see (RLS-scoped), newest first, with decrypted titles.
export const GET: RequestHandler = async ({ locals: { supabase, user } }) => {
  if (!user) throw error(401, 'auth required');
  const { data, error: selErr } = await supabase
    .from('sessions')
    .select('id, status, mode, title_encrypted, encryption_key_ref, started_at, ended_at, expires_at, host_id')
    .order('started_at', { ascending: false })
    .limit(100);
  if (selErr) throw error(500, selErr.message);

  // Display-only: shows expired sessions as "ended" without writing (avoids
  // N updates on a list read). The single-session GET is what persists it.
  const sessions = (data ?? []).map((s) => ({
    id: s.id,
    status: isExpired(s.status, s.expires_at) ? 'ended' : s.status,
    mode: s.mode,
    title: s.title_encrypted ? safeDecrypt(s.title_encrypted, s.encryption_key_ref) : null,
    started_at: s.started_at,
    ended_at: s.ended_at,
    is_host: s.host_id === user.id
  }));
  return json({ sessions });
};

function safeDecrypt(payload: string, keyRef: string | null): string | null {
  if (!keyRef) return null;
  try {
    return decrypt(payload, keyRef);
  } catch {
    return null; // never leak crypto errors to the client
  }
}
