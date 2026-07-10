export type CaptureState = 'idle' | 'connecting' | 'live' | 'closed';

export interface StartFrame {
  type: 'start';
  token?: string;
  sessionId: string;
  participantId: string;
}

// Captures mic audio and streams opus chunks to the realtime_server over WSS.
// Audio is never persisted; the server discards it after producing tokens.
export class AudioCapture {
  private ws: WebSocket | null = null;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

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
      if (msg.type === 'ready') this.beginRecording();
      else if (msg.type === 'error') this.onError(msg.message);
    };
    this.ws.onclose = () => this.onState('closed');
    this.ws.onerror = () => this.onError('connection error');
  }

  private beginRecording(): void {
    if (!this.stream) return;
    this.recorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm;codecs=opus' });
    this.recorder.ondataavailable = async (ev) => {
      if (ev.data.size && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(await ev.data.arrayBuffer());
      }
    };
    this.recorder.start(250); // 250ms chunks — low latency vs overhead
    this.onState('live');
  }

  stop(): void {
    this.recorder?.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ws?.close();
    this.onState('idle');
  }
}
