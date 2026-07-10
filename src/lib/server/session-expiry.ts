import type { SupabaseClient } from '@supabase/supabase-js';

export function isExpired(status: string, expiresAt: string | null): boolean {
  return status === 'active' && !!expiresAt && new Date(expiresAt) <= new Date();
}

/**
 * Lazy expiration: no background job. Whenever a session is touched (loaded,
 * joined, or an audio segment arrives), check its duration limit and flip it
 * to 'ended' right then if time's up. Returns the effective status so the
 * caller can act on it without a second read.
 */
export async function maybeExpireSession(
  supabase: SupabaseClient,
  sessionId: string,
  status: string,
  expiresAt: string | null
): Promise<string> {
  if (!isExpired(status, expiresAt)) return status;
  await supabase.from('sessions').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', sessionId);
  return 'ended';
}
