import { json, error } from '@sveltejs/kit';
import { PUBLIC_APP_URL } from '$env/static/public';
import { isSameOrigin, mintCentrifugoToken } from '$lib/server/centrifugo-token';
import { channels } from '$lib/realtime/channels';
import type { RequestHandler } from './$types';

// User-scoped Centrifugo token (personal channels: calendar-sync, session-history).
export const GET: RequestHandler = async ({ request, locals: { user } }) => {
  if (!isSameOrigin(request, PUBLIC_APP_URL)) throw error(403, 'cross-origin forbidden');
  if (!user) throw error(401, 'auth required');

  return json({ token: mintCentrifugoToken(user.id, [channels.calendarSync(user.id)]) });
};
