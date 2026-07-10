import { env } from '$env/dynamic/private';
import { formatTranscript } from './chunk';
import { callAndParseJson } from './retry-json';
import { chunkSystemPrompt, reduceSystemPrompt } from './prompts';
import type { Minutes, SummarizerAdapter, TranscriptEntry } from './types';

const MODEL = env.OPENAI_MINUTES_MODEL || 'gpt-4o-mini';

async function chat(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export function createOpenAIAdapter(): SummarizerAdapter {
  return {
    async summarizeChunk(entries: TranscriptEntry[], targetLanguage: string): Promise<Minutes> {
      const transcript = formatTranscript(entries);
      return callAndParseJson((strict) => chat(chunkSystemPrompt(targetLanguage, strict), transcript));
    },
    async reduce(parts: Minutes[], targetLanguage: string): Promise<Minutes> {
      const user = JSON.stringify(parts);
      return callAndParseJson((strict) => chat(reduceSystemPrompt(targetLanguage, strict), user));
    }
  };
}
