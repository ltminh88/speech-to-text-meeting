<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const s = $derived(data.session);
  let ending = $state(false);

  const modeLabel: Record<string, string> = { none: 'Transcription only', one_way: 'One-way', two_way: 'Two-way' };

  async function endSession() {
    ending = true;
    const res = await fetch(`/api/sessions/${page.params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ended' })
    });
    if (res.ok) goto('/dashboard');
    else ending = false;
  }
</script>

<main class="mx-auto max-w-3xl p-8">
  <header class="mb-6 flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-brand">{s.title ?? 'Untitled session'}</h1>
      <p class="mt-1 text-sm text-slate-500">
        {modeLabel[s.mode]} · {s.status}{s.no_record ? ' · no-record' : ''}
      </p>
    </div>
    {#if s.is_host && s.status === 'active'}
      <button onclick={endSession} disabled={ending} class="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 disabled:opacity-50">
        {ending ? 'Ending…' : 'End session'}
      </button>
    {/if}
  </header>

  <section class="mb-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400 dark:border-slate-700">
    Live captions appear here in Phase 2 (Soniox + Centrifugo).
  </section>

  <section>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Participants</h2>
    <ul class="divide-y divide-slate-100 dark:divide-slate-800">
      {#each data.participants as p (p.id)}
        <li class="flex items-center justify-between py-2 text-sm">
          <span>{p.guest_name ?? p.user_id ?? 'Unknown'}</span>
          <span class="text-slate-400">{p.role} · {p.status}</span>
        </li>
      {/each}
    </ul>
  </section>
</main>
