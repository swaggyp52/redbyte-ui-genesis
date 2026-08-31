# P2 Browser Journeys

Real-UI Playwright proofs (1440×900 unless noted). The store is read only to locate
DOM targets and assert; the UI performs the actions. Each entry: what it proves +
result. Browser-E0 evidence only.

| # | Journey file (packages/rb-e2e) | Proves | Result |
|---|--------------------------------|--------|--------|
| 1 | `source-files-journey.mjs` | Loading a project that carries HDL sources (as an imported project does) populates the source authority via `deriveSourceModel`; the Project explorer renders the Source files section grouped by fileset with honest capability tiers (VHDL/Verilog = "reconstructable") and the derived compile order. | **PASS** (1440×900, 0 page errors) |

## Conventions

- `executablePath: '/opt/pw-browsers/chromium'`.
- Store readable at `window.__RB_PROJECT_RUNTIME__.getState()`.
- Assert zero `pageerror`s.
- Capture at 1440×900 and 1366×768 for visual-jury slices; note 200% zoom where
  accessibility is in scope.
