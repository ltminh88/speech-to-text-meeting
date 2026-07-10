import { extractJson } from './json-extract';

/**
 * Calls the model once; if the response isn't valid JSON, retries exactly once
 * with `strict=true` (the caller appends a stricter instruction). A second
 * failure is allowed to throw — surfaced to the caller as a 500, per the
 * phase's risk mitigation (non-deterministic LLM output).
 */
export async function callAndParseJson<T>(callModel: (strict: boolean) => Promise<string>): Promise<T> {
  const first = await callModel(false);
  try {
    return extractJson<T>(first);
  } catch {
    const second = await callModel(true);
    return extractJson<T>(second);
  }
}
