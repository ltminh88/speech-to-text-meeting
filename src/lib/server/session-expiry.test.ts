import { describe, it, expect } from 'vitest';
import { isExpired } from './session-expiry';

describe('isExpired', () => {
  it('false when status is not active', () => {
    expect(isExpired('ended', new Date(Date.now() - 1000).toISOString())).toBe(false);
  });

  it('false when there is no duration limit', () => {
    expect(isExpired('active', null)).toBe(false);
  });

  it('false when the limit has not been reached yet', () => {
    expect(isExpired('active', new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });

  it('true when active and past expires_at', () => {
    expect(isExpired('active', new Date(Date.now() - 1000).toISOString())).toBe(true);
  });
});
