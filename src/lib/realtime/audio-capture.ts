export type CaptureState = 'idle' | 'connecting' | 'live' | 'closed';

export interface StartFrame {
  type: 'start';
  token?: string;
  sessionId: string;
  participantId: string;
}

const SEGMENT_MS = 4000; // Groq is REST/chunk-based (no persistent stream) — record self-contained clips.

// Captures mic audio as a sequence of complete, independently-decodable clips
// (one MediaRecorder per segment, so each blob has its own container header)
// and streams each clip to realtime_server over WSS. Audio is never persisted —
// the server discards each clip after transcription/translation.
export class AudioCapture {
  private ws: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private wsUrl: string,
    private startFrame: StartFrame,
    private onState: (s: CaptureState) => void,
    private onError: (msg: string) => void
  ) {}

  async start(): Promise<void> {
    this.onState('connecting');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => this.ws?.send(JSON.stringify(this.startFrame));
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'ready') this.recordNextSegment();
      else if (msg.type === 'error') this.onError(msg.message);
    };
    this.ws.onclose = () => this.onState('closed');
    this.ws.onerror = () => this.onError('connection error');
  }

  // Records one complete SEGMENT_MS clip, sends it, then immediately starts the next.
  private recordNextSegment(): void {
    if (this.stopped || !this.stream) return;
    this.onState('live');

    const recorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      if (blob.size && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(await blob.arrayBuffer());
      }
      this.recordNextSegment();
    };

    recorder.start();
    this.timer = setTimeout(() => recorder.stop(), SEGMENT_MS);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws?.close();
    this.onState('idle');
  }
}
