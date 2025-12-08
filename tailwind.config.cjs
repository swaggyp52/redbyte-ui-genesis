/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./packages/*/src/**/*.{js,ts,jsx,tsx}",
    "./apps/*/src/**/*.{js,ts,jsx,tsx}"
  ],
  safelist: [
    // Ensure core utilities are always included
    {
      pattern: /(bg|text|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
    },
    {
      pattern: /(inset|top|right|bottom|left)-(0|1|2|3|4|5|6|8|10|12|16|20|24|32|40|48|56|64)/,
    },
    'absolute',
    'relative',
    'fixed',
    'inset-0',
    'flex',
    'flex-col',
    'flex-row',
    'items-center',
    'justify-center',
    'justify-between',
    'gap-1',
    'gap-2',
    'gap-3',
    'gap-4',
    'rounded',
    'rounded-lg',
    'rounded-md',
    'shadow',
    'shadow-lg',
    'shadow-xl',
    'pointer-events-none',
    'cursor-pointer',
    'select-none',
    'transition-transform',
    'duration-150',
    'scale-105',
    'text-white',
    'text-xs',
    'text-sm',
    'text-base',
    'text-lg',
    'text-xl',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
