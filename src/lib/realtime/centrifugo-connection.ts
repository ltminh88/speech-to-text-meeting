import { Centrifuge } from 'centrifuge';
import { channels } from './channels';
import type { CaptionStore } from './caption-store.svelte';
import type { CaptionEvent } from './caption-types';

export type LinkState = 'connecting' | 'live' | 'retrying';

// Subscribe to a session's caption channel and feed events into the store.
// Returns a disposer. Token is fetched from the same-origin token endpoint.
export function subscribeCaptions(
  wsUrl: string,
  sessionId: string,
  store: CaptionStore,
  onState: (s: LinkState) => void
): () => void {
  const centrifuge = new Centrifuge(wsUrl, {
    getToken: async () => {
      const res = await fetch(`/api/centrifugo-token?sessionId=${sessionId}`);
      if (!res.ok) throw new Error('token fetch failed');
      return (await res.json()).token;
    }
  });

  const sub = centrifuge.newSubscription(channels.captions(sessionId));
  sub.on('publication', (ctx) => store.apply(ctx.data as CaptionEvent));

  centrifuge.on('connected', () => onState('live'));
  centrifuge.on('connecting', () => onState('retrying'));

  sub.subscribe();
  centrifuge.connect();

  return () => {
    sub.unsubscribe();
    centrifuge.disconnect();
  };
}
