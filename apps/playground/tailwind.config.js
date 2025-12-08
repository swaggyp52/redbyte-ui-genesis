module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    // Scan all monorepo package sources
    "../../packages/rb-shell/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/rb-apps/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/rb-windowing/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/rb-icons/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/rb-primitives/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/rb-theme/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
