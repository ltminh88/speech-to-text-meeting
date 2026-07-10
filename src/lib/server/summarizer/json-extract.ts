// LLMs sometimes wrap JSON in markdown code fences despite instructions not to —
// strip them before parsing rather than failing on well-formed-but-wrapped output.
export function extractJson<T>(raw: string): T {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '');
  return JSON.parse(stripped) as T;
}
