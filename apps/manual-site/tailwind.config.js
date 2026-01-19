/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'rb-bg': '#0b0f14',
        'rb-surface': '#0f1620',
        'rb-border': 'rgba(255,255,255,0.08)',
        'rb-text': 'rgba(255,255,255,0.92)',
        'rb-muted': 'rgba(255,255,255,0.62)',
        'rb-accent': '#3ff0c8',
        'rb-accent-dim': '#2dc9a7',
        'rb-accent-dim': '#2dd4a7',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      maxWidth: {
        'content': '1120px',
      },
    },
  },
  plugins: [],
}
