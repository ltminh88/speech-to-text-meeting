export interface Minutes {
  summary: string;
  actionItems: string[];
  decisions: string[];
}

export interface TranscriptEntry {
  speakerName: string;
  lang: string;
  text: string;
  translations: Record<string, string>;
}

// Provider-agnostic interface (OpenAI/Gemini) so the map-reduce driver never
// depends on a specific vendor's request/response shape.
export interface SummarizerAdapter {
  summarizeChunk(entries: TranscriptEntry[], targetLanguage: string): Promise<Minutes>;
  reduce(parts: Minutes[], targetLanguage: string): Promise<Minutes>;
}
