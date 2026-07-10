<script lang="ts">
  import LogoMark from '$lib/components/logo-mark.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-6 bg-app p-8 text-center">
  <div class="flex items-center gap-3">
    <LogoMark size={40} />
    <h1 class="text-3xl font-semibold text-ink-primary">Meet Plus</h1>
  </div>
  <p class="max-w-sm text-ink-secondary">Real-time translation &amp; meeting-minutes system</p>

  {#if data.session}
    <a
      href="/dashboard"
      class="rounded-full bg-brand px-6 py-3 font-medium text-white shadow-soft-md transition-colors hover:bg-brand-hover"
    >
      Go to dashboard
    </a>
    <form method="POST" action="/auth/logout">
      <button class="text-sm text-ink-muted underline">Sign out</button>
    </form>
  {:else}
    <a
      href="/auth/login"
      class="rounded-full bg-brand px-6 py-3 font-medium text-white shadow-soft-md transition-colors hover:bg-brand-hover"
    >
      Sign in with Google
    </a>
  {/if}
</main>
