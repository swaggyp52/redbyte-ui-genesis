# P2 Browser Journeys

Real-UI Playwright proofs (1440×900 unless noted). The store is read only to locate
DOM targets and assert; the UI performs the actions. Each entry: what it proves +
result. Browser-E0 evidence only.

| # | Journey file (packages/rb-e2e) | Proves | Result |
|---|--------------------------------|--------|--------|
| _(pending P2-2+)_ | | | |

## Conventions

- `executablePath: '/opt/pw-browsers/chromium'`.
- Store readable at `window.__RB_PROJECT_RUNTIME__.getState()`.
- Assert zero `pageerror`s.
- Capture at 1440×900 and 1366×768 for visual-jury slices; note 200% zoom where
  accessibility is in scope.
