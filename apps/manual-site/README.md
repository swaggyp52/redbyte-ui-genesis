# RedByte Manual Site

Marketing and documentation website for RedByte, deployed to [redbyteapps.dev](https://redbyteapps.dev).

## Overview

This is a modern, interactive website that explains what RedByte is, how to use it, and provides hands-on examples. It replaces the previous deployment of the RedByte OS itself.

## Features

- **Home Page**: Hero section with feature highlights
- **Getting Started**: Step-by-step tutorial for new users
- **Interactive Examples**: 
  - Logic Gate Playground (AND, OR, XOR, etc.)
  - 4-Bit Counter Circuit
  - Waveform Viewer with time scrubbing
- **Manual**: Complete reference documentation
- **About**: Project info, roadmap, and author details

## Tech Stack

- **Framework**: Vite + React 18
- **Styling**: Tailwind CSS
- **Routing**: React Router (hash routing for Cloudflare Pages)
- **TypeScript**: Type-safe development

## Development

```bash
# Run dev server
pnpm --filter @redbyte/manual-site dev
# or from root:
pnpm dev:manual

# Build for production
pnpm --filter @redbyte/manual-site build
# or from root:
pnpm build:manual

# Preview production build
pnpm --filter @redbyte/manual-site preview
```

Visit [http://localhost:5173](http://localhost:5173) during development.

## Deployment

The site is automatically deployed to Cloudflare Pages on push to `main`. The workflow builds this app instead of the RedByte OS.

**Cloudflare Build Settings:**
- Build command: `pnpm install --frozen-lockfile && pnpm --filter @redbyte/manual-site build`
- Output directory: `apps/manual-site/dist`
- Project: `redbyte-ui-genesis`

## RedByte OS Development

The RedByte OS code remains in the repo at `apps/playground` and can still be run locally:

```bash
pnpm dev  # Runs RedByte OS at localhost:4173
```

To switch back to deploying the OS instead of the manual site, update `.github/workflows/deploy-cloudflare.yml` to build and deploy `apps/playground/dist`.

## Structure

```
apps/manual-site/
├── src/
│   ├── components/
│   │   ├── examples/         # Interactive demos
│   │   │   ├── LogicGatePlayground.tsx
│   │   │   ├── CounterCircuit.tsx
│   │   │   └── WaveformViewer.tsx
│   │   └── layout/           # Header/Footer
│   ├── pages/                # Route pages
│   │   ├── Home.tsx
│   │   ├── GettingStarted.tsx
│   │   ├── Examples.tsx
│   │   ├── Manual.tsx
│   │   └── About.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   ├── icon.svg
│   └── screenshots/          # Placeholder images
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── package.json
└── README.md
```

## Design Notes

- **Dark Mode First**: Primary aesthetic with optional light mode
- **Neon Accents**: Cyan (#00d4ff) and green (#00ffaa) for digital logic vibe
- **Interactive**: All examples are fully functional React components
- **Responsive**: Mobile-first design
- **Fast**: Optimized build, sub-2s load time

## Contributing

The manual site follows the same development workflow as the main repo:
- Terminal-first development
- Small, reversible commits
- Update `AI_STATE.md` for meaningful changes

---

Built by Connor Angiel
