<script lang="ts">
  import { goto } from '$app/navigation';
  import { LANGUAGES, TRANSLATION_MODES, type TranslationMode } from '$lib/session/session-config';

  let title = $state('');
  let mode = $state<TranslationMode>('none');
  let no_record = $state(false);
  let source_language = $state('en');
  let target_language = $state('ja');
  let language_a = $state('en');
  let language_b = $state('ja');
  let durationMinutes = $state<number | null>(null);
  let submitting = $state(false);
  let err = $state<string | null>(null);

  const modeLabel: Record<TranslationMode, string> = { none: 'None', one_way: 'One-way', two_way: 'Two-way' };
  const DURATION_OPTIONS: { value: number | null; label: string }[] = [
    { value: null, label: 'No limit' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '60 min' },
    { value: 90, label: '90 min' }
  ];
  const inputClass =
    'mt-1 w-full rounded-lg border border-border bg-panel px-3 py-2 text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand';

  async function create() {
    submitting = true;
    err = null;
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, mode, no_record, source_language, target_language, language_a, language_b, durationMinutes })
    });
    if (res.ok) {
      const { sessionId } = await res.json();
      goto(`/session/${sessionId}`);
    } else {
      err = (await res.json().catch(() => ({}))).message ?? `Error ${res.status}`;
      submitting = false;
    }
  }
</script>

<main class="flex min-h-screen justify-center bg-app p-8">
  <div class="w-full max-w-lg">
    <a href="/dashboard" class="mb-4 inline-block text-sm text-ink-muted hover:text-ink-secondary">← Dashboard</a>
    <div class="rounded-2xl border border-border bg-panel p-8 shadow-soft-md">
      <h1 class="mb-6 text-xl font-semibold text-ink-primary">New session</h1>

      <label class="mb-5 block">
        <span class="text-sm font-medium text-ink-secondary">Title</span>
        <input bind:value={title} class={inputClass} placeholder="Weekly sync" />
      </label>

      <div class="mb-5">
        <span class="mb-1.5 block text-sm font-medium text-ink-secondary">Translation mode</span>
        <div class="inline-flex rounded-full border border-border bg-elevated p-1">
          {#each TRANSLATION_MODES as m}
            <button
              type="button"
              onclick={() => (mode = m)}
              class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors {mode === m
                ? 'bg-brand text-white shadow-soft-sm'
                : 'text-ink-secondary hover:text-ink-primary'}"
            >
              {modeLabel[m]}
            </button>
          {/each}
        </div>
      </div>

      {#if mode === 'one_way'}
        <div class="mb-5 grid grid-cols-2 gap-3">
          <label>
            <span class="text-sm font-medium text-ink-secondary">Source</span>
            <select bind:value={source_language} class={inputClass}>
              {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
            </select>
          </label>
          <label>
            <span class="text-sm font-medium text-ink-secondary">Target</span>
            <select bind:value={target_language} class={inputClass}>
              {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
            </select>
          </label>
        </div>
      {:else if mode === 'two_way'}
        <div class="mb-5 grid grid-cols-2 gap-3">
          <label>
            <span class="text-sm font-medium text-ink-secondary">Language A</span>
            <select bind:value={language_a} class={inputClass}>
              {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
            </select>
          </label>
          <label>
            <span class="text-sm font-medium text-ink-secondary">Language B</span>
            <select bind:value={language_b} class={inputClass}>
              {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
            </select>
          </label>
        </div>
      {/if}

      <div class="mb-5">
        <span class="mb-1.5 block text-sm font-medium text-ink-secondary">Duration limit</span>
        <div class="flex flex-wrap gap-1 rounded-full border border-border bg-elevated p-1">
          {#each DURATION_OPTIONS as opt}
            <button
              type="button"
              onclick={() => (durationMinutes = opt.value)}
              class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors {durationMinutes === opt.value
                ? 'bg-brand text-white shadow-soft-sm'
                : 'text-ink-secondary hover:text-ink-primary'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
        <p class="mt-1 text-xs text-ink-muted">Session auto-ends once the limit is reached.</p>
      </div>

      <label class="mb-6 flex items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" bind:checked={no_record} class="h-4 w-4 rounded border-border text-brand focus:ring-brand" />
        No-record mode (audio &amp; transcript never stored)
      </label>

      {#if err}<p class="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{err}</p>{/if}

      <button
        onclick={create}
        disabled={submitting}
        class="w-full rounded-full bg-brand px-5 py-2.5 font-medium text-white shadow-soft-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create session'}
      </button>
    </div>
  </div>
</main>
