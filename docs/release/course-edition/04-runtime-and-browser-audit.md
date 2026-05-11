# Runtime and Browser Audit

Date: 2026-05-11

## Install and Run

| Step | Command | Result |
| --- | --- | --- |
| Dependency check/install | `pnpm install --frozen-lockfile` | Passed. Lockfile was current. |
| Launcher smoke | `pnpm start:smoke` | Passed. `Start-RedByte.ps1` served HTTP 200 at `http://127.0.0.1:5197/`. |
| Dev server | `pnpm --filter @redbyte/playground exec vite --host 127.0.0.1 --port 5198 --strictPort` | Passed. Vite served `http://127.0.0.1:5198/`. |
| Browser tool | Playwright Chromium headless via `pnpm exec node --input-type=module -` | Passed with findings. |

The in-app browser/MCP tools were not exposed in this session after tool discovery, so the feedback loop used the repo's existing Playwright dependency from the shell. This did not add a product dependency.

Generated audit artifacts are local only:

| Artifact | Purpose |
| --- | --- |
| `.redbyte/course-edition/browser/browser-audit.json` | Six-surface browser audit. |
| `.redbyte/course-edition/browser/starter-workflow-audit.json` | Starter load and basic workflow audit. |
| `.redbyte/course-edition/browser/logic-gates-verify-detail.json` | Observe-only Verify detail. |
| `.redbyte/course-edition/browser/logic-gates-spa2-compare-export.json` | Same-page Verify Compare to Export handoff detail. |
| `.redbyte/course-edition/browser/screenshots/*.png` | Local screenshots for Project, Design, Verify, Hardware, Export, Import, and starter flows. |

## Six-Surface Browser Audit

URL opened: `http://127.0.0.1:5198/?mode=<mode>`

| Surface | Loaded marker | Browser result | Notes |
| --- | --- | --- | --- |
| Project | `project` | Passed | Shows workflow orientation, starter cards, recent/open project controls, and trust-boundary copy. |
| Design | `design` | Passed | Canvas/build library loaded. |
| Verify | `verify` | Passed | Verify surface loaded with observe/compare distinction. |
| Hardware / Map Pins | `hardware` | Passed | Basys3 resource list and map pins workflow loaded. |
| Export | `export` | Passed | Export blocked/needs-review state loaded for blank project; Vivado artifacts previewed where possible. |
| Import | `import` | Passed | Import workflow loaded and blocked steps were visible before upload/parse. |

The initial six-surface pass recorded:

| Signal | Count |
| --- | --- |
| Console warnings/errors | 0 |
| Page errors | 0 |
| Network failures | 0 |

## Starter Workflow Audit

Representative starters loaded from Project:

| Starter | Loaded | Verify attempted | Export observed | Browser finding |
| --- | --- | --- | --- | --- |
| Logic Gates: AND / OR / XOR | Yes | Yes | Yes | Export was available. Initial run defaulted to observe-only unless Compare checks was selected. |
| Half Adder | Yes | Yes | Yes | Export was available. Initial run defaulted to observe-only unless Compare checks was selected. |
| 2-Bit Up Counter (Basys3) | Yes | Yes | Yes | Export was available. Initial run defaulted to observe-only unless Compare checks was selected. |

The starter workflow pass recorded:

| Signal | Count |
| --- | --- |
| Console warnings/errors | 11 |
| Page errors | 0 |
| Network failures | 0 |

All 11 warnings were repeated instances from `packages/rb-apps/src/stores/circuitStore.ts`:

```text
[CircuitStore] Circuit mutation called but engines not connected!
```

The warning text says circuit mutations will not propagate to simulation. That may be a benign legacy store warning if the IDE runtime now uses `useProjectRuntime`, but it is not classroom-safe as a browser-console signal until classified.

## Verify and Export Trust Observation

For Logic Gates:

1. Load Logic Gates from Project.
2. Open Verify.
3. Click `Compare checks`.
4. Click `Run`.
5. Navigate to Export using the in-app stage nav, without full page reload.

Observed Verify state:

```text
PASS
Compare checks
Trusted comparison evidence. Continue to Map Pins or Export when ready.
CHECKS ALIGNED
12/12 match
100% coverage
```

Observed Export state after same-page navigation:

```text
Export Ready to Build
Export ready to build
Verify, mapping, and design inputs are ready for Export.
Vivado package ready to build
Verification
Checks match
```

This is a positive course-readiness signal for the official beginner combinational lane. It also shows an important UX risk: if the student only clicks `Run` while still in observe-only mode, Export correctly remains needs-review/draft, but the path from observe-only to Compare may still need student-facing emphasis.

## Confusing or Risky States

| Severity | Finding | Evidence | Suggested owner |
| --- | --- | --- | --- |
| P1 | Repeated `CircuitStore` engine-not-connected warnings during starter loading. | Browser console during starter workflow. | Runtime/IDE integration. |
| P2 | Verify starts in observe-only mode for loaded examples unless Compare checks is selected. | Logic Gates workflow: `OBSERVATION ONLY` after `Run - observe only`; Compare path passes only after explicit mode selection. | Verify surface and student docs. |
| P2 | Full page reload after a successful Verify Compare does not preserve the trusted Verify result into Export in the browser audit. | Query-route reload to Export showed `Verification Not run`; in-app navigation preserved trusted state. | Runtime persistence/docs; may be intended. |
| P2 | Export trust copy is strong, but E0/E1/E2/E3 tier labels were not prominent in the initial browser snippets. | Export text emphasizes draft/trusted/Vivado but local audit did not find E0 on starter export snippets. | Export surface and evidence guide. |
| P3 | PowerShell/console output displayed mojibake for some arrow/icon characters during terminal capture. | Browser text extraction through PowerShell showed encoded arrows/icons. | Docs/encoding/tooling; app may render correctly in browser screenshots. |

## Immediate Blockers to Student Use

No app-launch blocker was observed. The course-blocking risks are governance and trust-state clarity, not basic runtime availability:

1. Security review of tracked `.env`.
2. Stale docs competing with current product docs.
3. Tracked generated output and stale lockfile.
4. Browser console warning classification.
5. Explicit student guidance for Observe vs Compare, Draft vs Trusted, and E0/E1/E2/E3.
