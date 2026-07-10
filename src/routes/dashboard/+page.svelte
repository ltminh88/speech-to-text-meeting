<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import LogoMark from '$lib/components/logo-mark.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  let deletingId = $state<string | null>(null);

  const modeLabel: Record<string, string> = { none: 'Transcription', one_way: 'One-way', two_way: 'Two-way' };
  const statusDot: Record<string, string> = { active: 'bg-success', ended: 'bg-idle' };

  async function deleteSession(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This permanently removes its transcript and cannot be undone.`)) return;
    deletingId = id;
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) await invalidateAll();
    deletingId = null;
  }
</script>

<main class="mx-auto min-h-screen max-w-4xl bg-app p-8">
  <header class="mb-8 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <LogoMark size={28} />
      <h1 class="text-xl font-semibold text-ink-primary">Dashboard</h1>
    </div>
    <form method="POST" action="/auth/logout">
      <button class="text-sm text-ink-muted underline">Sign out</button>
    </form>
  </header>

  <div class="mb-6 flex gap-3">
    <a href="/sessions/new" class="rounded-full bg-brand px-5 py-2.5 font-medium text-white shadow-soft-sm transition-colors hover:bg-brand-hover">
      New session
    </a>
    <a href="/sessions/join" class="rounded-full border border-border px-5 py-2.5 font-medium text-ink-primary transition-colors hover:border-border-hover hover:bg-elevated">
      Join
    </a>
  </div>

  <p class="mb-4 text-sm text-ink-muted">Signed in as {data.email}</p>

  <div class="space-y-2">
    {#each data.sessions as s (s.id)}
      <div class="flex items-center justify-between rounded-xl border border-border bg-panel px-5 py-4 shadow-soft-sm transition-colors hover:border-border-hover">
        <a href={`/session/${s.id}`} class="flex items-center gap-2.5">
          <span class="h-2 w-2 shrink-0 rounded-full {statusDot[s.status] ?? 'bg-idle'}"></span>
          <span class="font-medium text-ink-primary hover:text-brand">{s.title ?? 'Untitled session'}</span>
        </a>
        <div class="flex items-center gap-3 text-sm text-ink-muted">
          <span>{modeLabel[s.mode] ?? s.mode} · {s.status}{s.is_host ? ' · host' : ''}</span>
          {#if s.is_host}
            <button
              onclick={() => deleteSession(s.id, s.title ?? 'Untitled session')}
              disabled={deletingId === s.id}
              class="text-error/70 transition-colors hover:text-error disabled:opacity-50"
              title="Delete session"
            >
              🗑
            </button>
          {/if}
        </div>
      </div>
    {:else}
      <div class="rounded-xl border border-dashed border-border py-12 text-center text-sm text-ink-muted">
        No sessions yet — create one to start.
      </div>
    {/each}
  </div>
</main>
