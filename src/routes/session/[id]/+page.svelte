<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { PUBLIC_CENTRIFUGO_WS_URL, PUBLIC_REALTIME_WS_URL } from '$env/static/public';
  import { CaptionStore } from '$lib/realtime/caption-store.svelte';
  import { subscribeCaptions, type LinkState } from '$lib/realtime/centrifugo-connection';
  import { AudioCapture, type CaptureState } from '$lib/realtime/audio-capture';
  import { displayText } from '$lib/realtime/caption-types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const s = $derived(data.session);

  const store = new CaptionStore();
  let link = $state<LinkState>('connecting');
  let capture: AudioCapture | null = null;
  let capState = $state<CaptureState>('idle');
  let capErr = $state<string | null>(null);
  let ending = $state(false);

  const modeLabel: Record<string, string> = { none: 'Transcription only', one_way: 'One-way', two_way: 'Two-way' };

  onMount(() => subscribeCaptions(PUBLIC_CENTRIFUGO_WS_URL, s.id, store, (st) => (link = st)));

  async function toggleSpeak() {
    if (capState === 'live' || capState === 'connecting') {
      capture?.stop();
      capture = null;
      return;
    }
    capErr = null;
    if (!s.my_participant_id) {
      capErr = 'no participant id (guests cannot broadcast yet)';
      return;
    }
    const { data: sess } = await data.supabase.auth.getSession();
    capture = new AudioCapture(
      PUBLIC_REALTIME_WS_URL,
      { type: 'start', token: sess.session?.access_token, sessionId: s.id, participantId: s.my_participant_id },
      (st) => (capState = st),
      (e) => (capErr = e)
    );
    await capture.start();
  }

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
  <header class="mb-4 flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-brand">{s.title ?? 'Untitled session'}</h1>
      <p class="mt-1 text-sm text-slate-500">{modeLabel[s.mode]} · {s.status}{s.no_record ? ' · no-record' : ''}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs" class:text-emerald-600={link === 'live'} class:text-amber-500={link !== 'live'}>
        ● {link}
      </span>
      {#if s.is_host && s.status === 'active'}
        <button onclick={endSession} disabled={ending} class="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50">
          {ending ? 'Ending…' : 'End'}
        </button>
      {/if}
    </div>
  </header>

  {#if s.status === 'active'}
    <button onclick={toggleSpeak} class="mb-4 rounded-lg bg-brand px-4 py-2 font-medium text-white">
      {capState === 'live' ? '⏹ Stop speaking' : '🎙 Start speaking'}
    </button>
    {#if capErr}<p class="mb-3 text-sm text-red-600">{capErr}</p>{/if}
  {/if}

  <section class="min-h-[16rem] space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
    {#each store.finals as f (f.sequenceNumber)}
      <p class="text-sm"><span class="font-medium text-slate-400">{f.speakerName || 'Speaker'}:</span> {displayText(f)}</p>
    {/each}
    {#each Object.values(store.partials) as p (p.speakerId)}
      <p class="text-sm italic text-slate-400">{p.speakerName || 'Speaker'}: {displayText(p)}…</p>
    {/each}
    {#if store.finals.length === 0 && Object.keys(store.partials).length === 0}
      <p class="py-12 text-center text-sm text-slate-400">Captions will appear here as people speak.</p>
    {/if}
  </section>

  <section class="mt-6">
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
