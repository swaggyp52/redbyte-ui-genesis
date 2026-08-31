# P2.5 Visual Jury — current-state baseline

Direct real-UI inspection of all five surfaces (Full Adder lab loaded) at
1440×900 and 1366×768. Screenshots under `baseline/`. **No root-axis overflow on
any surface at either viewport** — the shell geometry holds; Connor's problem is
**density, hierarchy, and clutter**, not overflow. A parallel per-surface code
audit ran alongside (workflow `redbyte-surface-audit`); its structured findings
are in the run journal and fold into the slice work.

Honesty rule: defects below are what was directly seen in the captured screenshots
and code. "Well-designed" is NOT claimed — that is the P2.5 outcome to earn.

## Surface health (worst → best)

### Simulate — WORST (Slice-3 fix landed for the top item)
- **[FIXED] Imported-VCD Analyzer dominated a native project.** The empty Analyzer
  card consumed ~180px and pushed the native scenario timeline + Drive inputs +
  Inspector below the fold. Now collapsed to a compact affordance until a VCD
  loads. (`simulate-1440x900.png` → `simulate-after-fix-1440x900.png`.)
- **[open] Provider bar** — still a full-width band on a native project; honest but
  could merge with the compact VCD affordance into one "Simulation provider" strip.
- **[partially fixed — Slice 1]** Duplicate status — the **footer** copy
  ("Simulation: Not run") was removed (Slice 1: footer is support-context only,
  proven by `shell-status-authority-journey.mjs`). Still open: Simulate state
  appears in both the header stage-nav and the provider card.
- **[open] The waveform (the real instrument) is behind a tab** while less-central
  panels take prime space. Slice 3 should make the waveform + Run + Observe/Compare
  the dominant objects.

### Board & Constraints — needs consolidation (Slice 4)
- **[open] Big orientation block** ("Plan Basys3 I/O and constraint intent" + the
  Assigned/Unassigned/Conflicts stat trio + "Ready for export" CTA) consumes the
  top ~25%, pushing the actual board visual down.
- **[open] Board diagram cramped/cut off** in the narrow middle column — it is the
  valuable conceptual object and should be more prominent + fully visible.
- **[open, reduced to 3× by Slice 1]** "Mapping complete" repeated — the **footer**
  copy was removed (Slice 1); still repeated in the header sub-label, the stat
  trio, and the "MAPPING COMPLETE" banner. Consolidate in Slice 4.
- **[open] Constraint-sets panel permanently expanded** at the bottom (advanced;
  should collapse to active-set + consequence, management behind disclosure).

### Project — moderate (Slice 2)
- **[FIXED — Slice 2]** Hero heading + **5 peer action buttons** → the landing now
  leads with one dominant "Start a Lab" card over a single subordinate
  alternatives cluster; the giant hero and the narration line are gone
  (`49abc102f`, proven by `project-landing-proof.mjs` at both viewports).
- **[open] Large empty region** below the small RECENT card at 1440×900.
- **[FIXED — Slice 1]** Duplicate status — the footer status bar no longer repeats
  Simulation/Board/Package state; the header stage-nav is the single per-stage
  authority (`shell-status-authority-journey.mjs`).

### Design — healthy (light touch in Slice 3)
- Canvas is the dominant object; clean toolbar; library rail ~220px, collapsible;
  circuit readable with labeled gates + CARRY/SUM probes.
- **[minor] "Show bottom panel" floating button**; library rail could be more
  responsive at 1366×768.

### Build & Export — healthy (light touch in Slice 4)
- Clear readiness story ("Draft export available - unverified"), one primary
  action, artifact tree + code preview + handoff inspector + submission guidance +
  external-Vivado boundary.
- **[minor] Duplicate** "Draft/unverified" phrasing between the header and the
  handoff inspector.

## Cross-surface

- **Duplicate status system — [RESOLVED, Slice 1]:** the footer status bar no
  longer repeats the header stage-navigator's per-stage status; the stage-nav is
  the single per-stage authority and the footer is support-context only
  (checks / storage / problems). Proven by `shell-status-authority-journey.mjs`.
- **Consistent shell** otherwise: one header, one stage nav, one footer, one main
  landmark, no overflow.

## Unproven (carry forward)

Per-surface 200% and reduced-motion (proven only for Simulate in P2), full keyboard
operability (focus order / no traps), contrast ratios, and headed 125% remain
**UNPROVEN** and are P2.5 Visual Acceptance Contract items. A screenshot proves
appearance at a moment, not a workflow; a journey proves only its assertions.

## Code audit — per-surface consolidation targets (workflow `redbyte-surface-audit`, 6 agents)

Full structured findings (regions, classifications, defects) are in the run
journal: `subagents/workflows/wf_4d31a7cf-02a/journal.jsonl`. The highest-value,
evidence-backed consolidations, by surface — these are the concrete Slice 1–7
work items:

### Shell (Slice 1)
- **One save authority:** keep the top-bar save dot **+ always-visible label**
  (remove the `<1400px` `display:none`); delete the status-bar "Storage" pill and
  ProjectSurface's separate save chip.
- **One owner for per-stage status:** keep the stage-nav hints; delete the footer
  Simulation/Board/Package/Problems pills (or the reverse); drop the always-warn
  `ide-status-support` pill and the dead `determinismHash` / `ide-status-build`.
- **Delete** the fixed "Board: Basys3" top-bar chip (never changes).
- **Render LocationBar only in Design** (reclaims a ~34px band on the other 4 stages).
- **Un-hide the blocked-stage marker** (real chip, not `display:none` + aria-only).
- **Merge `product-system-v3.css` + `unified-workbench-v3.css` shell rules** into one
  authority; remove the `!important`-fighting top-bar grid / dock-width / panel-controls
  / menu-popover blocks; delete dead `.ide-mode-breadcrumb` rules (4 files).
- **Collapse three Save entry points** (top-bar Save, More→Save As, ProjectSurface Save).

### Project (Slice 2)
- **One readiness ribbon** owning each fact once (Top · Target · Design N·M·wires · Sim
  · Mapping M/N · Saved) + a single blockers list (fold in `ProjectWarningsPanel`);
  remove the facts strip + evidence-tier chip + interface-strip + context "Current problems".
- **Delete dead controls:** `display:none` `.ide-project-v3-toolbar`, the `display:none`
  explorer Simulation/Constraints group divs, the always-hidden `ide-project-hero-status`,
  the `onPrimary:undefined` spine label.
- **Move CrossProbe + source-files capability detail** out of the 236px primary rail into a
  collapsible "Source ↔ visual" disclosure (source-backed/imported only); merge the two
  compile-order renders into one.
- **Trim the no-circuit landing:** one dominant "Start a Lab" + compact secondary group;
  drop the oversized hero + restating summary line so start/resume/recent fit one viewport.
- **One "Open Design"** (drop 3 of 4); one top-entity editor (drop the Technical-details copy).

### Design (Slice 3, light)
- **Delete** the `display:none !important` `ide-design-workspace-header`, the dead
  `ide-design-toolbar-customize` subsystem, the hidden second zoom indicator, and
  `ide-palette-section--board`; keep `ide-design-command-context-row` as the single header.
- **Merge right-dock Inspector + Properties** into one Inspector; fold the right-dock
  Constraints + left-dock Board I/O into one read-only "board bindings" (defer editing to Board).
- **Default the split ratio to favor the canvas (≥0.5)** so the circuit is dominant.

### Simulate (Slice 3, primary)
- **Collapse three signal browsers to one** (WaveformViewer lane column already owns
  select/pin/hide; delete `ide-verify-signal-shelf` + the left-dock signal rail + the
  duplicate All/Relevant toggles bound to the same state).
- **One canonical failure card** = `VerifyFailureExplanationPanel`; delete the ~6 other
  inline failure blocks + the duplicate second copy; **restore one real Observe/Compare
  segmented control** (or remove the ignored props).
- **Delete dead paths:** `showInlineFailureWorkbenchPanels=false` branch, the CSS-hidden
  `ide-verify-advanced-failure`, ~40 unused `VerifyCommandBarProps`; lift the Details-tab
  deep report (truth/kmap/vectors/results/hash) out of the waveform column.
- **Fuse `SimulationProviderBar` + the compact VCD affordance** into one strip (already
  partly done — the compact demotion landed; the full merge is the follow-on).

### Board & Constraints (Slice 4)
- **One readiness owner** (the progress header); delete the workflow-ribbon readiness
  callout; productSpine mirrors the same source.
- **Collapse four pin-assignment surfaces to one** table; fold PinPlanner conflict/XDC-diff
  into an "Advanced" disclosure; make bus mapping a row action; **show only one board
  graphic** on the mapping screen (move `VirtualBasys3Board` to Board Check).
- **Un-hide the Package-pin column** (drop the `display:none` at hardware CSS L619–622) —
  the pin is the objective; drop the redundant "Purpose" column.
- **Delete never-rendered `mapDock` + `mapInspector`;** collapse `ConstraintSetsPanel` to an
  "advanced" disclosure; adopt one surface name ("Board & Constraints") + one mode-toggle testid.

### Build & Export (Slice 4)
- **Delete the dead surface:** `ExportSurfacePrimitives.tsx` + in-file unused
  `gateStackSection`, `vivadoEvidenceRows`, `exportConfidenceRows`/pill, `keyArtifacts`,
  `primaryPackageArtifacts`, the dropped productSpine — nothing there renders.
- **Collapse the handoff-inspector aside into the decision header** (one facts block + one
  download); let the file workspace become 2 columns so the code preview regains ~300px.
- **One "what to submit"** home; **one primary download** (drop the duplicate); move hash/SHA
  jargon behind the Technical-evidence dialog; wire the already-written `syntaxHighlight()`.

**Cross-cutting:** the "vibe-coded" smell is concretely (a) status duplicated 3–8× per
surface, (b) large `display:none` blocks re-implemented live, (c) two shell stylesheets +
a 118KB verify stylesheet fighting via `!important`/specificity. Slice 1 should establish
one status authority + one shell-CSS authority before per-surface polish.
