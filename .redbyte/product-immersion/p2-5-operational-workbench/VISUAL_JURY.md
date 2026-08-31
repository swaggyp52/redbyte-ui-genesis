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
- **[open] Duplicate status** — Simulate state shown in header stage-nav ("Not
  run"), the provider card, and the footer ("Simulation: Not run").
- **[open] The waveform (the real instrument) is behind a tab** while less-central
  panels take prime space. Slice 3 should make the waveform + Run + Observe/Compare
  the dominant objects.

### Board & Constraints — needs consolidation (Slice 4)
- **[open] Big orientation block** ("Plan Basys3 I/O and constraint intent" + the
  Assigned/Unassigned/Conflicts stat trio + "Ready for export" CTA) consumes the
  top ~25%, pushing the actual board visual down.
- **[open] Board diagram cramped/cut off** in the narrow middle column — it is the
  valuable conceptual object and should be more prominent + fully visible.
- **[open] "Mapping complete" repeated 4×** (header sub-label, stat trio, "MAPPING
  COMPLETE" banner, footer).
- **[open] Constraint-sets panel permanently expanded** at the bottom (advanced;
  should collapse to active-set + consequence, management behind disclosure).

### Project — moderate (Slice 2)
- **[open] Hero heading** "Start your digital-logic project" + **5 peer action
  buttons** (Start a Lab / Build Fresh / Open Starter / Import Project / Open
  Existing). One dominant action wanted; secondary paths visually secondary.
- **[open] Large empty region** below the small RECENT card at 1440×900.
- **[open] Duplicate status** — header stage sub-labels + footer status bar repeat
  Simulation/Board/Package state.

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

- **Duplicate status system:** the header stage-navigator carries a sub-status per
  stage AND the footer status bar repeats much of it. Slice 1 should pick one
  home for truthful save/readiness status.
- **Consistent shell** otherwise: one header, one stage nav, one footer, one main
  landmark, no overflow.

## Unproven (carry forward)

Per-surface 200% and reduced-motion (proven only for Simulate in P2), full keyboard
operability (focus order / no traps), contrast ratios, and headed 125% remain
**UNPROVEN** and are P2.5 Visual Acceptance Contract items. A screenshot proves
appearance at a moment, not a workflow; a journey proves only its assertions.
