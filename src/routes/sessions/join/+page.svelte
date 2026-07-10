<script lang="ts">
  import { goto } from '$app/navigation';

  let code = $state('');
  let joining = $state(false);
  let err = $state<string | null>(null);

  // Accept a raw session id or a full /session/<id> link.
  function extractId(input: string): string {
    const m = input.trim().match(/([0-9a-f-]{36})/i);
    return m ? m[1] : input.trim();
  }

  async function join() {
    joining = true;
    err = null;
    const id = extractId(code);
    const res = await fetch(`/api/sessions/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) goto(`/session/${id}`);
    else {
      err = (await res.json().catch(() => ({}))).message ?? `Error ${res.status}`;
      joining = false;
    }
  }
</script>

<main class="flex min-h-screen justify-center bg-app p-8">
  <div class="w-full max-w-md">
    <a href="/dashboard" class="mb-4 inline-block text-sm text-ink-muted hover:text-ink-secondary">← Dashboard</a>
    <div class="rounded-2xl border border-border bg-panel p-8 shadow-soft-md">
      <h1 class="mb-6 text-xl font-semibold text-ink-primary">Join a session</h1>
      <label class="mb-5 block">
        <span class="text-sm font-medium text-ink-secondary">Session link or ID</span>
        <input
          bind:value={code}
          class="mt-1 w-full rounded-lg border border-border bg-panel px-3 py-2 text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          placeholder="https://…/session/…"
        />
      </label>
      {#if err}<p class="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{err}</p>{/if}
      <button
        onclick={join}
        disabled={joining || !code}
        class="w-full rounded-full bg-brand px-5 py-2.5 font-medium text-white shadow-soft-sm transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {joining ? 'Joining…' : 'Join'}
      </button>
    </div>
  </div>
</main>
