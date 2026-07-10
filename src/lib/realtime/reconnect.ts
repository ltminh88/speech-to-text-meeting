export type ConnState = 'connecting' | 'live' | 'retrying' | 'failed';

// 3-strike reconnect state machine (matches original: give up after 3 consecutive fails).
export class Reconnector {
  state: ConnState = 'connecting';
  private strikes = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private connect: () => void,
    private onState: (s: ConnState) => void,
    private maxStrikes = 3
  ) {}

  markLive(): void {
    this.strikes = 0;
    this.set('live');
  }

  markFailure(): void {
    this.strikes++;
    if (this.strikes >= this.maxStrikes) {
      this.set('failed');
      return;
    }
    this.set('retrying');
    const backoff = Math.min(1000 * 2 ** (this.strikes - 1), 4000);
    this.timer = setTimeout(() => this.connect(), backoff);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private set(s: ConnState): void {
    this.state = s;
    this.onState(s);
  }
}
