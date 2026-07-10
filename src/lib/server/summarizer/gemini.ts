import { env } from '$env/dynamic/private';
import { formatTranscript } from './chunk';
import { callAndParseJson } from './retry-json';
import { chunkSystemPrompt, reduceSystemPrompt } from './prompts';
import type { Minutes, SummarizerAdapter, TranscriptEntry } from './types';

const MODEL = env.GEMINI_MINUTES_MODEL || 'gemini-2.5-flash';

async function generate(system: string, user: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      })
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export function createGeminiAdapter(): SummarizerAdapter {
  return {
    async summarizeChunk(entries: TranscriptEntry[], targetLanguage: string): Promise<Minutes> {
      const transcript = formatTranscript(entries);
      return callAndParseJson((strict) => generate(chunkSystemPrompt(targetLanguage, strict), transcript));
    },
    async reduce(parts: Minutes[], targetLanguage: string): Promise<Minutes> {
      const user = JSON.stringify(parts);
      return callAndParseJson((strict) => generate(reduceSystemPrompt(targetLanguage, strict), user));
    }
  };
}
