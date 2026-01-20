# OS QA Checklist (Polish Pass)

Date: 2026-01-20
Scope: RedByte OS (apps/playground + packages/rb-shell + packages/rb-apps)
Method: Static code review + known UX risks. Runtime walkthrough is required to confirm these findings.

Status Legend:
- Open
- Fixed (add commit SHA)
- Partial (add commit SHA + note)
- Deferred (reason)

## Top 10 Issues (ordered by impact)

1) Welcome screen uses light theme styles on dark OS
- Where: `packages/rb-apps/src/apps/WelcomeApp.tsx`
- Repro: Open Welcome app on first boot or via launcher.
- Expected: Welcome panel matches OS dark theme and typography.
- Actual: Inline light theme colors and gradients; low contrast in dark shell.
- Severity: Major
- Hypothesis: Legacy inline styles bypass OS styling tokens.
- Fix plan:
  - Replace inline styles with CSS module using OS tokens.
  - Align buttons to primary/secondary styles.
  - Ensure text contrast on dark backgrounds.
- Status: Open

2) No "Start Here" onboarding or 2-minute success path
- Where: OS desktop / launcher
- Repro: First boot, user is left to hunt for the right apps.
- Expected: A single entry point with 3 actions (playground demo, FPGA sim, inspector demo).
- Actual: Welcome app is generic; no guided flow or sample bundle.
- Severity: Major
- Hypothesis: Onboarding plan not yet implemented.
- Fix plan:
  - Add Start Here app and pin it.
  - Provide 3 actions tied to real apps.
  - Add a deterministic sample bundle for Inspector.
- Status: Open

3) Bridge instructions are outdated and confusing
- Where: StudentLabApp hardware panel (`packages/rb-apps/src/apps/StudentLabApp.tsx`)
- Repro: Open hardware panel when bridge is offline.
- Expected: Clear guidance to start `rb-fpga-bridge` with correct command.
- Actual: References `node tools/desktop-bridge.js` (legacy path), which is not the current bridge flow.
- Severity: Major
- Hypothesis: Copy predates the FPGA bridge integration.
- Fix plan:
  - Replace copy with `pnpm --filter @redbyte/fpga-bridge dev` or `node packages/rb-fpga-bridge/src/index.js`.
  - Include SIM mode option in message.
- Status: Open

4) Inconsistent button/input styles across apps
- Where: StudentLabApp, LogicLabApp, SubmissionInspectorApp, HardwarePanelApp
- Repro: Compare buttons/inputs across apps.
- Expected: Consistent button hierarchy and input styling.
- Actual: Each app uses custom styles; inconsistent spacing and contrast.
- Severity: Major
- Hypothesis: No shared token layer for CSS modules.
- Fix plan:
  - Introduce OS tokens for colors/spacing/radius.
  - Add shared button/input classes in a common CSS file.
  - Apply to lab apps with minimal changes.
- Status: Open

5) Shell chrome looks neon compared to lab apps
- Where: `packages/rb-shell/src/ShellWindow.tsx`, `packages/rb-shell/src/Dock.tsx`
- Repro: Open Lab apps alongside Shell chrome.
- Expected: Unified, minimal, technical styling.
- Actual: Cyan glow gradients on shell chrome; lab apps are neutral/dark.
- Severity: Major
- Hypothesis: Shell uses hardcoded Tailwind palette instead of shared tokens.
- Fix plan:
  - Define OS tokens and use them in shell chrome.
  - Reduce glow/shadow intensity for consistency.
- Status: Open

6) Oscilloscope hover readout contains garbled glyph
- Where: `packages/rb-apps/src/components/OscilloscopeView.tsx`
- Repro: Hover a signal in oscilloscope view.
- Expected: Clear text like `t=0.123s v=1`.
- Actual: Contains corrupted glyph after the time value.
- Severity: Minor
- Hypothesis: Encoding issue in UI string.
- Fix plan:
  - Replace glyph with ASCII separator (e.g., `,` or `|`).
- Status: Open

7) Inspector has no sample bundle or guided entry
- Where: SubmissionInspectorApp empty state
- Repro: Launch Inspector with no file.
- Expected: One-click "Load sample bundle" for demo flow.
- Actual: Only file picker and drag/drop; no demo path.
- Severity: Major
- Hypothesis: Sample bundle not wired yet.
- Fix plan:
  - Add deterministic sample bundle under `/samples`.
  - Add "Load sample bundle" button and/or Start Here path.
- Status: Open

8) Mixed typography across OS surfaces
- Where: Shell uses Tailwind defaults; apps use CSS modules with various fonts.
- Repro: Compare text in Shell chrome vs lab apps.
- Expected: Consistent sans + mono usage with shared sizing.
- Actual: Mixed fonts (system-ui, Segoe UI, custom monospace) and inconsistent sizes.
- Severity: Minor
- Hypothesis: CSS modules define fonts locally.
- Fix plan:
  - Define `--rb-font-sans` and `--rb-font-mono` tokens.
  - Apply to root and CSS modules.
- Status: Open

9) Empty/error states are uneven across lab apps
- Where: StudentLabApp, SubmissionInspectorApp
- Repro: No bridge running, no lab loaded, no trace, invalid bundle.
- Expected: Clear empty state with action guidance.
- Actual: Some sections show raw text only; no consistent style.
- Severity: Major
- Hypothesis: Each app implements its own empty state style.
- Fix plan:
  - Create shared empty state styling in tokens.
  - Standardize banners and helper text in lab apps.
- Status: Open

10) Start-up confidence signals are hidden
- Where: OS desktop and launcher
- Repro: First boot or app launch.
- Expected: Visible "Start Here" entry and clear success path.
- Actual: Launcher shows list of apps but no priority guidance.
- Severity: Major
- Hypothesis: No default app pinning or onboarding callout.
- Fix plan:
  - Pin Start Here app in launcher and/or dock.
  - Add small callout in Welcome/Start Here for first-time users.
- Status: Open
