import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Server-to-server publish into a Centrifugo channel via its HTTP API.
// Phase 0: smoke-test helper. Phase 2 replaces the caller with realtime_server.
export const POST: RequestHandler = async ({ request, locals: { user } }) => {
  if (!user) throw error(401, 'auth required');
  const { channel, data } = await request.json();
  if (!channel) throw error(400, 'channel required');

  const res = await fetch(`${env.CENTRIFUGO_API_URL}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': env.CENTRIFUGO_API_KEY ?? ''
    },
    body: JSON.stringify({ channel, data: data ?? {} })
  });

  if (!res.ok) throw error(502, `centrifugo publish failed: ${res.status}`);
  return json({ ok: true });
};
