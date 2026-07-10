// In-memory latest-snapshot store per realtime component (web, extension,
// realtime_server, queue_worker). Consumed by the admin queue-health page (Phase 6).

export interface HealthSnapshot {
  component: string;
  updatedAt: number;
  metrics: Record<string, number>;
}

const store = new Map<string, HealthSnapshot>();

export function putHealth(component: string, metrics: Record<string, number>, now: number): void {
  store.set(component, { component, updatedAt: now, metrics });
}

export function allHealth(): HealthSnapshot[] {
  return [...store.values()];
}
