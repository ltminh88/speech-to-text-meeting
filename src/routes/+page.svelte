<script lang="ts">
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8 text-center">
  <h1 class="text-3xl font-semibold text-brand">Meet Plus</h1>
  <p class="text-slate-500">Real-time Translation & Meeting Minutes System</p>

  {#if data.session}
    <a class="rounded-lg bg-brand px-5 py-2.5 font-medium text-white" href="/dashboard">Go to dashboard</a>
    <form method="POST" action="/auth/logout"><button class="text-sm text-slate-400 underline">Sign out</button></form>
  {:else}
    <a class="rounded-lg bg-brand px-5 py-2.5 font-medium text-white" href="/auth/login">Sign in with Google</a>
  {/if}
</main>
