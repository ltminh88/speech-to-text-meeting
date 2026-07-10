<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let minutes = $state(untrack(() => data.minutes));
  let generatedAt = $state(untrack(() => data.generatedAt));
  let generating = $state(false);
  let err = $state<string | null>(null);
  let message = $state<string | null>(null);

  // Re-sync local state when SvelteKit hands us fresh `data` (e.g. navigating
  // between two sessions' minutes pages without a full component remount).
  $effect(() => {
    minutes = data.minutes;
    generatedAt = data.generatedAt;
  });

  async function generate() {
    generating = true;
    err = null;
    message = null;
    const res = await fetch(`/api/sessions/${page.params.id}/minutes`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      minutes = body.minutes;
      generatedAt = body.generatedAt ?? null;
      if (!minutes) message = body.message ?? 'No transcript available.';
    } else {
      err = body.message ?? `Error ${res.status}`;
    }
    generating = false;
  }

  function copyMarkdown() {
    if (!minutes) return;
    const md = [
      '# Meeting Minutes',
      '',
      '## Summary',
      minutes.summary,
      '',
      '## Action Items',
      ...(minutes.actionItems.length ? minutes.actionItems.map((a: string) => `- ${a}`) : ['- (none)']),
      '',
      '## Decisions',
      ...(minutes.decisions.length ? minutes.decisions.map((d: string) => `- ${d}`) : ['- (none)'])
    ].join('\n');
    navigator.clipboard.writeText(md);
  }
</script>

<main class="mx-auto min-h-screen max-w-3xl bg-app p-8">
  <header class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-ink-primary">Meeting Minutes</h1>
    <a href={`/session/${page.params.id}`} class="text-sm text-ink-muted underline hover:text-ink-secondary">Back to session</a>
  </header>

  {#if data.session.is_host}
    <button
      onclick={generate}
      disabled={generating}
      class="mb-4 rounded-full bg-brand px-5 py-2.5 font-medium text-white shadow-soft-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
    >
      {generating ? 'Generating…' : minutes ? 'Regenerate' : 'Generate minutes'}
    </button>
  {/if}

  {#if err}<p class="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{err}</p>{/if}
  {#if message}<p class="mb-4 text-sm text-ink-muted">{message}</p>{/if}

  {#if minutes}
    <div class="space-y-6 rounded-2xl border border-border bg-panel p-6 shadow-soft-sm">
      <div class="flex items-center justify-between">
        {#if generatedAt}<p class="text-xs text-ink-muted">Generated {new Date(generatedAt).toLocaleString()}</p>{/if}
        <button onclick={copyMarkdown} class="text-sm text-brand underline hover:text-brand-hover">Copy as Markdown</button>
      </div>
      <section>
        <h2 class="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">Summary</h2>
        <p class="text-sm text-ink-primary">{minutes.summary}</p>
      </section>
      <section>
        <h2 class="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">Action Items</h2>
        {#if minutes.actionItems.length}
          <ul class="list-disc space-y-1 pl-5 text-sm text-ink-primary">
            {#each minutes.actionItems as item}<li>{item}</li>{/each}
          </ul>
        {:else}
          <p class="text-sm text-ink-muted">None</p>
        {/if}
      </section>
      <section>
        <h2 class="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">Decisions</h2>
        {#if minutes.decisions.length}
          <ul class="list-disc space-y-1 pl-5 text-sm text-ink-primary">
            {#each minutes.decisions as item}<li>{item}</li>{/each}
          </ul>
        {:else}
          <p class="text-sm text-ink-muted">None</p>
        {/if}
      </section>
    </div>
  {:else if !message}
    <p class="rounded-2xl border border-dashed border-border py-12 text-center text-sm text-ink-muted">No minutes generated yet.</p>
  {/if}
</main>
