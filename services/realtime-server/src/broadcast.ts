import { config } from './config.js';
import { timed } from './metrics.js';
import type { CaptionEventName, CaptionPayload } from './types.js';

const captionsChannel = (sessionId: string) => `captions:session:${sessionId}`;

// Publish a caption event into the session's Centrifugo channel (server-side only).
export async function broadcastCaption(
  sessionId: string,
  event: CaptionEventName,
  payload: CaptionPayload
): Promise<void> {
  await timed('broadcast', async () => {
    const res = await fetch(`${config.centrifugoApiUrl}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': config.centrifugoApiKey },
      body: JSON.stringify({ channel: captionsChannel(sessionId), data: { event, payload } })
    });
    if (!res.ok) throw new Error(`centrifugo publish ${res.status}`);
  });
}
