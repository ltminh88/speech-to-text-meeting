import type { Config } from 'tailwindcss';

// Colors/shadows sourced verbatim from the original app's shipped CSS
// (design tokens are authoritative — never guessed).
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0f766e', hover: '#0d9488' }, // teal-700 base, brightens to teal-600 on hover
        app: 'var(--color-bg-app)',
        panel: 'var(--color-bg-panel)',
        elevated: 'var(--color-bg-elevated)',
        border: { DEFAULT: 'var(--color-border)', hover: 'var(--color-border-hover)' },
        ink: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          muted: 'var(--color-text-muted)'
        },
        success: '#10b981',
        error: '#e11d48',
        warning: '#f97316',
        info: '#0ea5e9',
        idle: '#94a3b8'
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        heading: ['Lexend', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'soft-sm': '0 2px 8px rgb(15 23 42 / 0.04)',
        'soft-md': '0 4px 16px rgb(15 23 42 / 0.08)',
        'soft-lg': '0 8px 24px rgb(15 23 42 / 0.12)',
        'soft-xl': '0 16px 48px rgb(15 23 42 / 0.16)'
      }
    }
  },
  plugins: []
} satisfies Config;
