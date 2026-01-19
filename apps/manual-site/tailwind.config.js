/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Core surfaces
        'rb-bg': '#0c0e12',
        'rb-surface': '#13161c',
        'rb-raised': '#1a1e26',

        // Borders
        'rb-border': 'rgba(255,255,255,0.08)',
        'rb-border-subtle': 'rgba(255,255,255,0.04)',
        'rb-border-strong': 'rgba(255,255,255,0.16)',

        // Text
        'rb-text': '#e8e8eb',
        'rb-muted': '#8b8d94',
        'rb-dim': '#5a5c62',

        // Accent (warm red - "RedByte")
        'rb-accent': '#e85c5c',
        'rb-accent-dim': '#c74a4a',
        'rb-accent-bg': 'rgba(232, 92, 92, 0.1)',

        // Secondary (cool blue)
        'rb-info': '#5c8ce8',
        'rb-info-dim': '#4a72c7',
        'rb-info-bg': 'rgba(92, 140, 232, 0.1)',

        // Signals (for waveform viewer)
        'rb-signal-clk': '#5ce8c8',
        'rb-signal-a': '#5c8ce8',
        'rb-signal-b': '#a85ce8',
        'rb-signal-out': '#e8a85c',
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h1': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        'h2': ['1.75rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
        'h3': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['1rem', { lineHeight: '1.7' }],
        'small': ['0.875rem', { lineHeight: '1.6' }],
        'xs': ['0.75rem', { lineHeight: '1.5' }],
      },
      maxWidth: {
        'content': '1120px',
        'narrow': '680px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'modal': '0 8px 32px rgba(0, 0, 0, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
