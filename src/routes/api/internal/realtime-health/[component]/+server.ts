import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { putHealth, allHealth } from '$lib/server/realtime-health-store';
import type { RequestHandler } from './$types';

// Ingest a metrics snapshot from an internal service (realtime_server, etc.).
// Authenticated by a shared internal key, NOT a user session.
export const POST: RequestHandler = async ({ params, request }) => {
  const key = request.headers.get('x-internal-key');
  if (!key || key !== env.CENTRIFUGO_API_KEY) throw error(403, 'forbidden');

  const metrics = (await request.json()) as Record<string, number>;
  putHealth(params.component, metrics, Date.now());
  return json({ ok: true });
};

// Admin reads all snapshots (Phase 6 gates this behind admin role).
export const GET: RequestHandler = async ({ locals: { user } }) => {
  if (!user) throw error(401, 'auth required');
  return json({ components: allHealth() });
};
