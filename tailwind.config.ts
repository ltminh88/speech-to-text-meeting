import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#0d9488', dark: '#0f766e' } },
      fontFamily: { sans: ['Lexend', 'Source Sans 3', 'system-ui', 'sans-serif'] }
    }
  },
  plugins: []
} satisfies Config;
