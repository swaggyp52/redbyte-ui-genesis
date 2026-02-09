/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#334155',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', 'Helvetica Neue', 'sans-serif'],
        mono: ['Consolas', 'Monaco', 'Courier New', 'monospace'],
        digital: ['"Share Tech Mono"', 'Consolas', 'monospace'],
        tech: ['Rajdhani', '-apple-system', 'sans-serif'],
        'tech-display': ['Orbitron', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s infinite',
        'in': 'in 0.2s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
        'slide-in-from-top-2': 'slideDown 0.2s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 10px rgba(6, 182, 212, 0.4)' },
          '50%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.8), 0 0 30px rgba(6, 182, 212, 0.4)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      scale: {
        '102': '1.02',
      },
    },
  },
  plugins: [],
}
