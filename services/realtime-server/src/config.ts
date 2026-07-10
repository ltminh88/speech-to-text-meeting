import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} is required`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  appOrigin: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173',

  supabaseUrl: required('PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: required('PUBLIC_SUPABASE_ANON_KEY'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  groqApiKey: process.env.GROQ_API_KEY ?? '',
  groqSttModel: process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo',
  groqLlmModel: process.env.GROQ_LLM_MODEL ?? 'llama-3.3-70b-versatile',

  // Fixed cadence for segment-based capture (client records self-contained clips of this length).
  audioSegmentMs: Number(process.env.AUDIO_SEGMENT_MS ?? 4000),

  centrifugoApiUrl: process.env.CENTRIFUGO_API_URL ?? 'http://localhost:8000/api',
  centrifugoApiKey: process.env.CENTRIFUGO_API_KEY ?? '',

  transcriptMasterKey: process.env.TRANSCRIPT_MASTER_KEY ?? ''
};
