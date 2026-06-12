---
name: redbyte-browser-proof
description: Use when proving RedByte browser workflows, screenshots, viewport geometry, local dev startup, or Playwright-backed product evidence.
---

# RedByte Browser Proof

## Startup

1. Prefer `corepack pnpm run dev` for local Vite development unless a production preview is required.
2. Use `.\Start-RedByte.ps1 -Production -Port <port>` or `pnpm start:smoke` only when validating production-style routing.
3. Record the exact URL and port used.
4. If a dev server is started in the background, record how it will be stopped.

## Capture Policy

- Store local screenshots and JSON summaries under ignored `.redbyte/...` paths.
- Capture the viewport dimensions in artifact names.
- Capture console errors and page geometry with screenshots.
- Include clean-start states and dirty/resume states when the product risk involves persistence or stale evidence.

## Proof Policy

- Screenshots support visual review but are not enough for behavior claims.
- Playwright assertions support behavior claims only for the asserted workflow.
- Use route, locator, and geometry assertions for first-viewport issues.
- Use workflow assertions for state repair, export readiness, mapping, and project persistence.
- Do not claim Vivado, bitstream, board programming, or hardware observation from browser evidence.

## Closeout

List artifact paths, viewport set, route set, console status, dev-server status, and any known environment caveat.
