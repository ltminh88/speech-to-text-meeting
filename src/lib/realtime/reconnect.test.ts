import { describe, it, expect, vi } from 'vitest';
import { Reconnector } from './reconnect';

describe('Reconnector — 3-strike state machine', () => {
  it('markLive resets strikes and sets live', () => {
    const states: string[] = [];
    const r = new Reconnector(() => {}, (s) => states.push(s));
    r.markLive();
    expect(r.state).toBe('live');
  });

  it('fails after 3 consecutive strikes', () => {
    vi.useFakeTimers();
    const connect = vi.fn();
    const r = new Reconnector(connect, () => {}, 3);
    r.markFailure(); // strike 1 → retrying
    r.markFailure(); // strike 2 → retrying
    expect(r.state).toBe('retrying');
    r.markFailure(); // strike 3 → failed
    expect(r.state).toBe('failed');
    r.stop();
    vi.useRealTimers();
  });

  it('schedules a reconnect on non-terminal failure', () => {
    vi.useFakeTimers();
    const connect = vi.fn();
    const r = new Reconnector(connect, () => {}, 3);
    r.markFailure();
    vi.advanceTimersByTime(2000);
    expect(connect).toHaveBeenCalled();
    r.stop();
    vi.useRealTimers();
  });
});
