import { describe, it, expect, vi } from 'vitest';
import { callAndParseJson } from './retry-json';

describe('callAndParseJson', () => {
  it('returns parsed result on first valid response, no retry', async () => {
    const callModel = vi.fn(async () => '{"a":1}');
    const result = await callAndParseJson<{ a: number }>(callModel);
    expect(result).toEqual({ a: 1 });
    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel).toHaveBeenCalledWith(false);
  });

  it('retries once with strict=true when the first response is invalid JSON', async () => {
    const callModel = vi.fn().mockResolvedValueOnce('not json').mockResolvedValueOnce('{"a":2}');
    const result = await callAndParseJson<{ a: number }>(callModel);
    expect(result).toEqual({ a: 2 });
    expect(callModel).toHaveBeenNthCalledWith(2, true);
  });

  it('throws if the retry also returns invalid JSON', async () => {
    const callModel = vi.fn().mockResolvedValue('still not json');
    await expect(callAndParseJson(callModel)).rejects.toThrow();
    expect(callModel).toHaveBeenCalledTimes(2);
  });
});
