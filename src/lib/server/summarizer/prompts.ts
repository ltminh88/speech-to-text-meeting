import { LANGUAGES } from '$lib/session/session-config';

function langName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

const SHAPE = '{"summary": string, "actionItems": string[], "decisions": string[]}';
const STRICT_SUFFIX = ' Output STRICT JSON only — no markdown code fences, no commentary, nothing before or after.';

export function chunkSystemPrompt(targetLanguage: string, strict: boolean): string {
  const base = `You produce meeting-minutes JSON from a transcript excerpt. Output ONLY a JSON object: ${SHAPE}. Write all text in ${langName(targetLanguage)}. If nothing qualifies for actionItems or decisions, use an empty array.`;
  return strict ? base + STRICT_SUFFIX : base;
}

export function reduceSystemPrompt(targetLanguage: string, strict: boolean): string {
  const base = `Merge these partial meeting-minutes JSON objects into one final JSON object with the same shape: ${SHAPE}. Deduplicate overlapping points. Write all text in ${langName(targetLanguage)}.`;
  return strict ? base + STRICT_SUFFIX : base;
}
