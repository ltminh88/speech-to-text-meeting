<script lang="ts">
  import { page } from '$app/state';
  const error = $derived(page.url.searchParams.get('error'));
  const redirectTo = $derived(page.url.searchParams.get('redirectTo') ?? '/dashboard');
</script>

<main class="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-6 p-8 text-center">
  <h1 class="text-2xl font-semibold text-brand">Meet Plus</h1>
  <p class="text-sm text-slate-500">Sign in to start translating and capturing meetings.</p>

  {#if error}
    <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
  {/if}

  <a
    class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
    href={`/auth/login?redirectTo=${encodeURIComponent(redirectTo)}`}
  >
    Sign in with Google
  </a>
</main>
