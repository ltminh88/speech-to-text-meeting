import { json, error } from '@sveltejs/kit';
import { PUBLIC_APP_URL } from '$env/static/public';
import { isSameOrigin, mintCentrifugoToken } from '$lib/server/centrifugo-token';
import { channels } from '$lib/realtime/channels';
import type { RequestHandler } from './$types';

// Session-scoped Centrifugo token. Optional ?sessionId auto-subscribes the session channels.
export const GET: RequestHandler = async ({ request, url, locals: { user } }) => {
  if (!isSameOrigin(request, PUBLIC_APP_URL)) throw error(403, 'cross-origin forbidden');
  if (!user) throw error(401, 'auth required');

  const sessionId = url.searchParams.get('sessionId');
  const subscribeTo = sessionId
    ? [channels.captions(sessionId), channels.settings(sessionId), channels.participants(sessionId)]
    : undefined;

  return json({ token: mintCentrifugoToken(user.id, subscribeTo) });
};
