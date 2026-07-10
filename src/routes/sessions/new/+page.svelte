<script lang="ts">
  import { goto } from '$app/navigation';
  import { LANGUAGES, type TranslationMode } from '$lib/session/session-config';

  let title = $state('');
  let mode = $state<TranslationMode>('none');
  let no_record = $state(false);
  let source_language = $state('en');
  let target_language = $state('ja');
  let language_a = $state('en');
  let language_b = $state('ja');
  let submitting = $state(false);
  let err = $state<string | null>(null);

  async function create() {
    submitting = true;
    err = null;
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, mode, no_record, source_language, target_language, language_a, language_b })
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

<main class="mx-auto max-w-lg p-8">
  <h1 class="mb-6 text-2xl font-semibold text-brand">New session</h1>

  <label class="mb-4 block">
    <span class="text-sm font-medium">Title</span>
    <input bind:value={title} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" placeholder="Weekly sync" />
  </label>

  <label class="mb-4 block">
    <span class="text-sm font-medium">Translation mode</span>
    <select bind:value={mode} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
      <option value="none">None (transcription only)</option>
      <option value="one_way">One-way (source → target)</option>
      <option value="two_way">Two-way (A ↔ B)</option>
    </select>
  </label>

  {#if mode === 'one_way'}
    <div class="mb-4 grid grid-cols-2 gap-3">
      <label><span class="text-sm">Source</span>
        <select bind:value={source_language} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
        </select></label>
      <label><span class="text-sm">Target</span>
        <select bind:value={target_language} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
        </select></label>
    </div>
  {:else if mode === 'two_way'}
    <div class="mb-4 grid grid-cols-2 gap-3">
      <label><span class="text-sm">Language A</span>
        <select bind:value={language_a} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
        </select></label>
      <label><span class="text-sm">Language B</span>
        <select bind:value={language_b} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          {#each LANGUAGES as l}<option value={l.code}>{l.label}</option>{/each}
        </select></label>
    </div>
  {/if}

  <label class="mb-6 flex items-center gap-2">
    <input type="checkbox" bind:checked={no_record} />
    <span class="text-sm">No-record mode (audio &amp; transcript never stored)</span>
  </label>

  {#if err}<p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>{/if}

  <button onclick={create} disabled={submitting} class="rounded-lg bg-brand px-5 py-2.5 font-medium text-white disabled:opacity-50">
    {submitting ? 'Creating…' : 'Create session'}
  </button>
</main>
