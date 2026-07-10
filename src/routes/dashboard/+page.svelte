<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto max-w-4xl p-8">
  <header class="mb-8 flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-brand">Dashboard</h1>
    <form method="POST" action="/auth/logout">
      <button class="text-sm text-slate-400 underline">Sign out</button>
    </form>
  </header>
  <p class="text-slate-500">Signed in as <span class="font-medium">{data.email}</span></p>
  <p class="mt-4 text-sm text-slate-400">Session list &amp; realtime meeting UI arrive in Phase 1–2.</p>
</main>
