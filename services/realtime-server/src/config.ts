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

  sonioxApiKey: process.env.SONIOX_API_KEY ?? '',
  sonioxWsUrl: process.env.SONIOX_WS_URL ?? 'wss://stt-rt.soniox.com/transcribe-websocket',

  centrifugoApiUrl: process.env.CENTRIFUGO_API_URL ?? 'http://localhost:8000/api',
  centrifugoApiKey: process.env.CENTRIFUGO_API_KEY ?? '',

  transcriptMasterKey: process.env.TRANSCRIPT_MASTER_KEY ?? '',

  // Backpressure: max buffered audio frames per connection before dropping oldest.
  maxAudioQueue: Number(process.env.MAX_AUDIO_QUEUE ?? 50)
};
