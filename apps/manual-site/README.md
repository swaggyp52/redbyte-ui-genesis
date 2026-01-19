# RedByte Manual Site

Documentation and showcase website for RedByte, deployed to [redbyteapps.dev](https://redbyteapps.dev).

## Overview

This is a clean, human-designed documentation site that explains what RedByte is, how to use it, and provides interactive examples. The design prioritizes clarity and intentionality over flashy effects.

## Features

- **Home Page**: Clear value proposition with feature highlights
- **Getting Started**: Prerequisites, installation, and first circuit walkthrough
- **Interactive Examples**:
  - Logic Gate Playground (AND, OR, XOR, NAND, NOR, XNOR, NOT)
  - 4-Bit Counter Circuit with clock history
  - Waveform Viewer with time scrubbing and deterministic playback
- **Manual**: Complete reference documentation with sidebar navigation
- **For Educators**: Demo overview, honest implementation status, course integration ideas
- **About**: Philosophy, core principles, and roadmap
- **Guided Tour**: 5-step onboarding overlay

## Tech Stack

- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **Routing**: React Router (hash routing for Cloudflare Pages)
- **Fonts**: JetBrains Mono (code), System UI (body)

## Development

```bash
# Run dev server
pnpm --filter @redbyte/manual-site dev

# Build for production
pnpm --filter @redbyte/manual-site build

# Preview production build
pnpm --filter @redbyte/manual-site preview
```

Visit [http://localhost:5173](http://localhost:5173) during development.

---

## Professor Demo Script

A 2-3 minute walkthrough for demonstrating RedByte to educators.

### Setup (before the demo)

1. Open the manual site in a browser
2. Have the Examples page ready at `/#/examples`

### Script

**1. Introduction (30 seconds)**

> "RedByte is a browser-based environment for teaching digital logic. Everything runs locally—no cloud, no accounts, no VM setup. Students just open a URL."

- Show the home page briefly
- Click "Take a Tour" to show the guided walkthrough (optional)

**2. Interactive Examples (60 seconds)**

Navigate to `/examples` and demonstrate:

- **Logic Gate Playground**: Toggle inputs A and B, switch between gate types (AND → OR → XOR). Point out the truth table highlighting the current state.

- **4-Bit Counter**: Click "Clock Pulse" several times. Show the binary representation updating and the history tracking each tick.

- **Waveform Viewer**: Click Play to run the simulation. Pause it, then scrub the timeline backward and forward. Highlight: "Every simulation is deterministic—you can always go back to see exactly what happened."

**3. For Educators Page (30 seconds)**

Navigate to `/demo`:

- Show the "Implementation Status" section with honest checkmarks
- Point to the "Course Integration Ideas" with the 12-week outline
- Mention: "Lab Workbench for assignments, Submission Inspector for grading"

**4. Close (30 seconds)**

> "RedByte is still under active development, but the core simulation engine is working. The main thing missing is the visual canvas editor—right now circuit editing is table-based. We're focused on getting the fundamentals right before adding polish."

- Point to the Download button (placeholder for now)
- Offer to answer questions

### Key talking points

- **Determinism**: Same inputs always produce same outputs. Step backward through time.
- **Local-first**: No server required. Works offline after initial load.
- **Education-focused**: Labs, submissions, grading workflow.
- **Honest about status**: Core works, visual canvas is in progress.

---

## Deployment to Cloudflare Pages

### Build Settings

| Setting | Value |
|---------|-------|
| Build command | `pnpm install --frozen-lockfile && pnpm --filter @redbyte/manual-site build` |
| Output directory | `apps/manual-site/dist` |
| Root directory | `/` |
| Node.js version | 20.x |

### Verification Checklist

After deployment, verify the correct site is live:

**1. Check the page title**
- Should be "RedByte" (not "RedByte OS")

**2. Check the HTML source**
```bash
curl -s https://redbyteapps.dev | head -50
```
Look for:
- `<title>RedByte</title>`
- References to `assets/index-*.js` (manual site)
- Should NOT contain `rb-apps-*.css` (that's the OS app)

**3. Check the JS bundle names**
```bash
curl -s https://redbyteapps.dev | grep -o 'assets/[^"]*\.js'
```
The manual site produces bundles named `index-*.js`. The OS produces bundles with different names.

**4. Visual check**
- Navigate to the site
- You should see the documentation homepage with "Learn digital logic by building it."
- NOT the OS desktop with windows

**5. Check specific routes**
- `/#/examples` → Interactive Examples page with Logic Gate Playground
- `/#/manual` → Manual page with sidebar navigation
- `/#/about` → About page with roadmap

### Troubleshooting

**Wrong site deployed?**

1. Check `.github/workflows/deploy-cloudflare.yml` to ensure it builds `@redbyte/manual-site`
2. Check the Cloudflare Pages build logs for which directory was deployed
3. Clear Cloudflare cache and redeploy

**Hash routing not working?**

1. Ensure `vite.config.ts` has `base: './'` or is using hash router
2. Check that routes use `/#/path` format

---

## Design System

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `rb-bg` | `#0c0e12` | Page background |
| `rb-surface` | `#13161c` | Cards, sections |
| `rb-raised` | `#1a1e26` | Elevated elements |
| `rb-accent` | `#e85c5c` | Primary action, highlights |
| `rb-info` | `#5c8ce8` | Secondary highlights |
| `rb-text` | `#e8e8eb` | Primary text |
| `rb-muted` | `#8b8d94` | Secondary text |
| `rb-dim` | `#5a5c62` | Tertiary text |

### Typography

- **Headings**: System sans-serif, tight tracking
- **Body**: System sans-serif, 1.7 line height
- **Code**: JetBrains Mono

### Principles

- **Warm, not cold**: Coral-red accent instead of cyan
- **Typography-driven**: Spacing and type hierarchy carry the design
- **Restrained motion**: Hover states only, no constant animations
- **Honest content**: Clear distinction between "works today" and "planned"

---

## Structure

```text
apps/manual-site/
├── src/
│   ├── components/
│   │   ├── examples/           # Interactive demos
│   │   ├── layout/             # Header, Footer
│   │   └── GuidedTour.tsx      # Onboarding overlay
│   ├── pages/                  # Route pages
│   │   ├── Home.tsx
│   │   ├── GettingStarted.tsx
│   │   ├── Examples.tsx
│   │   ├── Manual.tsx
│   │   ├── Demo.tsx            # For Educators
│   │   └── About.tsx
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

Built by Connor Angiel
