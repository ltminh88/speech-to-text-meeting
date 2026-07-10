import jwt from 'jsonwebtoken';
import { env } from '$env/dynamic/private';

const TOKEN_TTL_SECONDS = 60 * 10; // 10 min; client SDK refreshes before expiry.

/**
 * Same-origin guard: reject token requests whose Origin/Referer is cross-origin.
 * Relative (empty Origin) same-tab requests are allowed. Mirrors the original app.
 */
export function isSameOrigin(request: Request, appOrigin: string): boolean {
  const origin = request.headers.get('origin');
  if (origin) return origin === appOrigin;
  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).origin === appOrigin;
    } catch {
      return false;
    }
  }
  return true; // no Origin/Referer → same-tab navigation
}

/** Mint a Centrifugo connection JWT (HMAC). `channels` server-side auto-subscribes. */
export function mintCentrifugoToken(sub: string, channels?: string[]): string {
  const secret = env.CENTRIFUGO_HMAC_SECRET;
  if (!secret) throw new Error('CENTRIFUGO_HMAC_SECRET not configured');

  const payload: Record<string, unknown> = {
    sub,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  };
  if (channels?.length) payload.channels = channels;

  return jwt.sign(payload, secret, { algorithm: 'HS256' });
}
