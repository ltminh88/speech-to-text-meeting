<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();

  let deletingId = $state<string | null>(null);

  async function deleteSession(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This permanently removes its transcript and cannot be undone.`)) return;
    deletingId = id;
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (res.ok) await invalidateAll();
    deletingId = null;
  }
</script>

<main class="mx-auto max-w-4xl p-8">
  <header class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-brand">Dashboard</h1>
    <form method="POST" action="/auth/logout">
      <button class="text-sm text-slate-400 underline">Sign out</button>
    </form>
  </header>

  <div class="mb-8 flex gap-3">
    <a href="/sessions/new" class="rounded-lg bg-brand px-4 py-2 font-medium text-white">New session</a>
    <a href="/sessions/join" class="rounded-lg border border-slate-300 px-4 py-2 font-medium dark:border-slate-700">Join</a>
  </div>

  <p class="mb-2 text-sm text-slate-400">Signed in as {data.email}</p>

  <ul class="divide-y divide-slate-100 dark:divide-slate-800">
    {#each data.sessions as s (s.id)}
      <li class="flex items-center justify-between py-3">
        <a href={`/session/${s.id}`} class="font-medium hover:text-brand">{s.title ?? 'Untitled session'}</a>
        <div class="flex items-center gap-3">
          <span class="text-sm text-slate-400">{s.mode} · {s.status}{s.is_host ? ' · host' : ''}</span>
          {#if s.is_host}
            <button
              onclick={() => deleteSession(s.id, s.title ?? 'Untitled session')}
              disabled={deletingId === s.id}
              class="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
              title="Delete session"
            >
              🗑
            </button>
          {/if}
        </div>
      </li>
    {:else}
      <li class="py-6 text-center text-sm text-slate-400">No sessions yet — create one to start.</li>
    {/each}
  </ul>
</main>
