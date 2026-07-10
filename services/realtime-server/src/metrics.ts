// Lightweight p95 timers + missing-translation ratio. Thresholds match the original
// admin/queue-health debug panel (strategy §2). Exposed to SvelteKit health endpoint.

class Window {
  private samples: number[] = [];
  constructor(private cap = 512) {}
  add(v: number) {
    this.samples.push(v);
    if (this.samples.length > this.cap) this.samples.shift();
  }
  p95(): number {
    if (!this.samples.length) return 0;
    const s = [...this.samples].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
  }
}

const timers: Record<string, Window> = {
  dbSave: new Window(),
  broadcast: new Window(),
  tokenProcess: new Window()
};

let finalsFlushed = 0;
let finalsMissingTranslation = 0;

export async function timed<T>(name: keyof typeof timers, fn: () => Promise<T> | T): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    timers[name].add(performance.now() - start);
  }
}

export function recordTokenProcess(ms: number) {
  timers.tokenProcess.add(ms);
}

export function recordFinal(hasTranslation: boolean) {
  finalsFlushed++;
  if (!hasTranslation) finalsMissingTranslation++;
}

export function snapshot() {
  const missingRatio = finalsFlushed ? finalsMissingTranslation / finalsFlushed : 0;
  const mem = process.memoryUsage();
  return {
    dbSaveP95Ms: Math.round(timers.dbSave.p95()),
    broadcastP95Ms: Math.round(timers.broadcast.p95()),
    tokenProcessP95Ms: Math.round(timers.tokenProcess.p95()),
    missingTranslationRatio: Number(missingRatio.toFixed(3)),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    finalsFlushed
  };
}

// Threshold reference (warn / crit) from the bundle.
export const THRESHOLDS = {
  dbSaveP95Ms: [300, 1000],
  broadcastP95Ms: [100, 500],
  tokenProcessP95Ms: [50, 200],
  missingTranslationRatio: [0.1, 0.25],
  heapUsedMb: [200, 400]
} as const;
