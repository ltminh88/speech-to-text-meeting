<script lang="ts">
  import { onMount } from 'svelte';
  import { goto, invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import { PUBLIC_CENTRIFUGO_WS_URL, PUBLIC_REALTIME_WS_URL } from '$env/static/public';
  import { CaptionStore } from '$lib/realtime/caption-store.svelte';
  import { subscribeCaptions, type LinkState } from '$lib/realtime/centrifugo-connection';
  import { AudioCapture, type CaptureState } from '$lib/realtime/audio-capture';
  import type { CaptionPayload, StoredSegment } from '$lib/realtime/caption-types';
  import { LANGUAGES } from '$lib/session/session-config';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const s = $derived(data.session);

  const store = new CaptionStore();
  let link = $state<LinkState>('connecting');
  let capture: AudioCapture | null = null;
  let capState = $state<CaptureState>('idle');
  let capErr = $state<string | null>(null);
  let ending = $state(false);
  let reopening = $state(false);
  let scrollEl: HTMLDivElement | undefined = $state();
  let expanded = $state(false);

  // Auto-scroll to the newest caption whenever a new final line arrives.
  $effect(() => {
    store.finals.length;
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  });

  const modeLabel: Record<string, string> = { none: 'Transcription only', one_way: 'One-way', two_way: 'Two-way' };

  // Two fixed language "slots" for the split view. Which slot holds the original
  // vs. the translation is decided per-line, based on which language was spoken.
  const leftLang = $derived(s.mode === 'two_way' ? s.language_a : s.source_language);
  const rightLang = $derived(s.mode === 'two_way' ? s.language_b : s.target_language);

  function langLabel(code: string | null): string {
    return LANGUAGES.find((l) => l.code === code)?.label ?? code ?? '—';
  }

  interface SplitRow {
    left: string | null;
    leftTranslated: boolean;
    right: string | null;
    rightTranslated: boolean;
  }

  // Route the spoken text + its translation into the correct fixed column.
  function splitRow(f: CaptionPayload): SplitRow {
    const translated = Object.entries(f.translations)[0]?.[1] ?? null;
    if (f.lang === rightLang) {
      return { left: translated, leftTranslated: true, right: f.text, rightTranslated: false };
    }
    return { left: f.text, leftTranslated: false, right: translated, rightTranslated: true };
  }

  const SPEAKER_COLORS = [
    'text-blue-600 dark:text-blue-400',
    'text-rose-600 dark:text-rose-400',
    'text-amber-600 dark:text-amber-400',
    'text-violet-600 dark:text-violet-400'
  ];
  function speakerColor(id: string): string {
    let hash = 0;
    for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return SPEAKER_COLORS[hash % SPEAKER_COLORS.length];
  }

  onMount(() => {
    // Backfill already-persisted transcript before the live feed picks up,
    // so leaving and rejoining (or a plain refresh) doesn't lose history.
    fetch(`/api/sessions/${s.id}/transcript`)
      .then((res) => (res.ok ? res.json() : { segments: [] }))
      .then(({ segments }: { segments: StoredSegment[] }) => {
        store.loadHistory(segments.map((seg): CaptionPayload => ({ ...seg, isFinal: true })));
      })
      .catch(() => {});

    return subscribeCaptions(PUBLIC_CENTRIFUGO_WS_URL, s.id, store, (st) => (link = st));
  });

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

  // Sessions never expire on their own — a host can resume an ended one at
  // any time, same id and transcript, just live again.
  async function reopenSession() {
    reopening = true;
    const res = await fetch(`/api/sessions/${page.params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' })
    });
    if (res.ok) await invalidateAll();
    reopening = false;
  }
</script>

<main class="mx-auto min-h-screen max-w-5xl bg-app p-8">
  <header class="mb-5 flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-semibold text-ink-primary">{s.title ?? 'Untitled session'}</h1>
      <p class="mt-1 text-sm text-ink-muted">{modeLabel[s.mode]} · {s.status}{s.no_record ? ' · no-record' : ''}</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="flex items-center gap-1.5 rounded-full border border-border bg-panel px-3 py-1 text-xs font-medium text-ink-secondary">
        <span class="h-1.5 w-1.5 rounded-full {link === 'live' ? 'bg-success' : 'bg-warning'}"></span>
        {link}
      </span>
      <a
        href={`/session/${s.id}/minutes`}
        class="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-ink-primary transition-colors hover:border-border-hover hover:bg-elevated"
      >
        📝 Minutes
      </a>
      {#if s.is_host && s.status === 'active'}
        <button
          onclick={endSession}
          disabled={ending}
          class="rounded-full border border-error/30 px-4 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
        >
          {ending ? 'Ending…' : 'End'}
        </button>
      {:else if s.is_host && s.status === 'ended'}
        <button
          onclick={reopenSession}
          disabled={reopening}
          class="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white shadow-soft-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {reopening ? 'Reopening…' : '▶ Reopen'}
        </button>
      {/if}
    </div>
  </header>

  {#if s.status === 'active'}
    <button
      onclick={toggleSpeak}
      class="mb-4 rounded-full px-5 py-2.5 font-medium text-white shadow-soft-sm transition-colors {capState === 'live'
        ? 'bg-warning hover:bg-warning/90'
        : 'bg-brand hover:bg-brand-hover'}"
    >
      {capState === 'live' ? '⏹ Stop speaking' : '🎙 Start speaking'}
    </button>
    {#if capErr}<p class="mb-3 text-sm text-error">{capErr}</p>{/if}
  {/if}

  {#if s.mode === 'none'}
    <!-- Transcription-only: no translation exists, so a single column is all there is. -->
    <section class="min-h-[16rem] space-y-3 rounded-2xl border border-border bg-panel p-5 shadow-soft-sm">
      {#each store.finals as f (f.sequenceNumber)}
        <p class="text-sm text-ink-primary"><span class="font-medium {speakerColor(f.speakerId)}">{f.speakerName || 'Speaker'}:</span> {f.text}</p>
      {/each}
      {#if store.finals.length === 0}
        <p class="py-12 text-center text-sm text-ink-muted">Captions will appear here as people speak.</p>
      {/if}
    </section>
  {:else}
    {#snippet splitView(compact: boolean)}
      <div class="grid grid-cols-2 divide-x divide-border bg-elevated text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <div class="px-5 py-2.5">{langLabel(leftLang)}</div>
        <div class="px-5 py-2.5">{langLabel(rightLang)}</div>
      </div>
      <div
        bind:this={scrollEl}
        class="grid grid-cols-2 divide-x divide-border overflow-y-auto"
        class:max-h-[28rem]={compact}
        class:flex-1={!compact}
      >
        {#each store.finals as f (f.sequenceNumber)}
          {@const row = splitRow(f)}
          <div class="px-5 py-3">
            <p class="mb-0.5 text-xs font-medium {speakerColor(f.speakerId)}">
              {f.speakerName || 'Speaker'}
              {#if row.leftTranslated}
                <span class="ml-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-normal text-success">Translated</span>
              {/if}
            </p>
            {#if row.left}<p class={compact ? 'text-sm text-ink-primary' : 'text-lg text-ink-primary'} class:italic={row.leftTranslated} class:text-ink-tertiary={row.leftTranslated}>{row.left}</p>{/if}
          </div>
          <div class="px-5 py-3">
            <p class="mb-0.5 text-xs font-medium {speakerColor(f.speakerId)}">
              {f.speakerName || 'Speaker'}
              {#if row.rightTranslated}
                <span class="ml-1 rounded-full bg-success/10 px-1.5 py-0.5 text-[10px] font-normal text-success">Translated</span>
              {/if}
            </p>
            {#if row.right}<p class={compact ? 'text-sm text-ink-primary' : 'text-lg text-ink-primary'} class:italic={row.rightTranslated} class:text-ink-tertiary={row.rightTranslated}>{row.right}</p>{/if}
          </div>
        {:else}
          <p class="col-span-2 py-12 text-center text-sm text-ink-muted">Captions will appear here as people speak.</p>
        {/each}
      </div>
    {/snippet}

    <!-- Split view: fixed language columns, original text lands in whichever
         column matches the speaker's language, translation in the other.
         Unmounted while expanded (below) to avoid a duplicate scrollEl bind. -->
    {#if !expanded}
      <section class="overflow-hidden rounded-2xl border border-border bg-panel shadow-soft-sm">
        <div class="flex justify-end border-b border-border px-2 py-1">
          <button onclick={() => (expanded = true)} class="rounded-full px-3 py-1 text-xs text-ink-muted transition-colors hover:bg-elevated">
            ⛶ Expand
          </button>
        </div>
        {@render splitView(true)}
      </section>
    {/if}

    {#if expanded}
      <div class="fixed inset-0 z-50 flex flex-col bg-app p-6">
        <div class="mb-3 flex shrink-0 items-center justify-between">
          <h2 class="text-lg font-semibold text-ink-primary">{s.title ?? 'Untitled session'}</h2>
          <button
            onclick={() => (expanded = false)}
            class="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-ink-primary transition-colors hover:border-border-hover hover:bg-elevated"
          >
            ✕ Exit fullscreen
          </button>
        </div>
        <div class="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-panel shadow-soft-lg">
          {@render splitView(false)}
        </div>
      </div>
    {/if}
  {/if}

  <section class="mt-6 rounded-2xl border border-border bg-panel p-5 shadow-soft-sm">
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">Participants</h2>
    <ul class="divide-y divide-border">
      {#each data.participants as p (p.id)}
        <li class="flex items-center justify-between py-2 text-sm">
          <span class="text-ink-primary">{p.guest_name ?? p.user_id ?? 'Unknown'}</span>
          <span class="text-ink-muted">{p.role} · {p.status}</span>
        </li>
      {/each}
    </ul>
  </section>
</main>
