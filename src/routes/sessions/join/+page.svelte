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

<main class="mx-auto max-w-md p-8">
  <h1 class="mb-6 text-2xl font-semibold text-brand">Join a session</h1>
  <label class="mb-4 block">
    <span class="text-sm font-medium">Session link or ID</span>
    <input bind:value={code} class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900" placeholder="https://…/session/…" />
  </label>
  {#if err}<p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{err}</p>{/if}
  <button onclick={join} disabled={joining || !code} class="rounded-lg bg-brand px-5 py-2.5 font-medium text-white disabled:opacity-50">
    {joining ? 'Joining…' : 'Join'}
  </button>
</main>
