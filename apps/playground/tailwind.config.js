// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// All rights reserved. Unauthorized use, reproduction or distribution is prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

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
