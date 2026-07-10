<script lang="ts">
  import { page } from '$app/state';
  import LogoMark from '$lib/components/logo-mark.svelte';
  import GoogleIcon from '$lib/components/google-icon.svelte';
  const error = $derived(page.url.searchParams.get('error'));
  const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/dashboard');
</script>

<main class="flex min-h-screen flex-col items-center justify-center gap-6 bg-app p-8">
  <div class="w-full max-w-sm rounded-2xl border border-border bg-panel p-8 text-center shadow-soft-lg">
    <div class="mb-2 flex items-center justify-center gap-2">
      <LogoMark size={32} />
      <h1 class="text-xl font-semibold text-ink-primary">Meet Plus</h1>
    </div>
    <p class="mb-6 text-sm text-ink-secondary">Sign in to start translating and capturing meetings.</p>

    {#if error}
      <p class="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
    {/if}

    <a
      class="flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-3 font-medium text-ink-primary transition-colors hover:border-border-hover hover:bg-elevated"
      href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
    >
      <GoogleIcon />
      Sign in with Google
    </a>
  </div>
</main>
