<script lang="ts">
  import '../app.css';
  let { children } = $props();

  let isDark = $state(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  function toggleTheme() {
    isDark = !isDark;
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }
</script>

<button
  onclick={toggleTheme}
  aria-label="Toggle dark mode"
  class="fixed right-4 top-4 z-50 grid h-9 w-9 place-items-center rounded-full border border-border bg-panel text-ink-secondary shadow-soft-sm transition-colors hover:border-border-hover"
>
  {isDark ? '☀️' : '🌙'}
</button>

{@render children()}
