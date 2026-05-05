---
doc_status: current
last_validated: 2026-05-04
owner: Connor Angiel
used_by_claude: true
role: canonical product flow model â€” whole-IDE UX and information architecture
---

# RedByte IDE â€” Product Flow Model

**Purpose of this doc:** Single authoritative reference for what each surface is, how the surfaces connect, what information lives where, and what the known UX friction points are. This is a planning and alignment document. It does not make implementation changes. All implementation must refer to and stay consistent with this model.

---

## 1. Product Identity

RedByte IDE is a **deterministic FPGA workflow surface** for Basys3 hardware. It is not a general-purpose HDL editor. It is not a Vivado wrapper. It is a structured, opinionated pipeline: students **design a circuit**, **prove it digitally**, **bind it to board pins**, and **export a Vivado-ready package**. The board runs exactly what the student proved.

The canonical workflow is linear:

```
Project â†’ Design â†’ Verify â†’ Map Pins â†’ Export
```

Import is a utility entry point (not a workflow step). It lets students load prior work into the pipeline, not bypass it.

Board programming is an external handoff after Export. The IDE does not program the board.

---

## 2. Global Shell Contract

### 2.1 Persistent elements (all surfaces)

| Region | What lives there | Notes |
|--------|-----------------|-------|
| Top bar | Product mark, project name, board target badge ("Basys3"), save state, keyboard shortcut help | Always visible, never changes per surface |
| Left rail | Project button + 4 workflow step buttons (Design/Verify/Map Pins/Export) | Active state = current surface. Numeric badge = step number (not item count). OK badge = step complete. |
| Status bar | "Mode: [surface]" | Minimal. Remains across surfaces. |
| Workflow Review button | Bottom right corner | Debug/review utility â€” review whether to surface to students at all |

### 2.2 Surface-scoped chrome (appears only when relevant)

The following toggles appear at the top-right of the content area and are **scoped to specific surfaces**. They should not appear on Project:

| Toggle | Applicable surfaces |
|--------|-------------------|
| Toolbar On/Off | Design only |
| Rails On/Off | Design, Verify only |
| Verify rows On/Off | Verify only |
| Console On/Off | Design, Verify (debug use) |

**Current state:** These toggles appear on all surfaces including Project. This is a product inconsistency â€” they are developer/debug chrome, not student-facing controls. They should be hidden by default on all surfaces in a student-facing pass.

### 2.3 Breadcrumb pattern

Each surface renders a breadcrumb: `RedByte / [Project name] / [Surface] / [Board]`. This is correct and consistent across all 5 surfaces.

---

## 3. Surface Contracts

### 3.1 Project (Dashboard)

**Role:** Home surface. Project identity, readiness truth, and next-action routing.

**Primary actions:**
1. Review project status and readiness at a glance.
2. Navigate to the right next step in the workflow.
3. Load a starter example or start fresh (with confirmation guard).

**What students should see:**
1. **Project identity card** â€” name, description, board, save state.
2. **One dominant next-action card** â€” a single honest CTA based on actual readiness.
3. **Readiness strip** â€” INPUTS, OUTPUTS, MAPPED, VERIFY, EXPORT, BOARD chips.
4. **Board pin mapping summary** â€” read-only; Map Pins owns editing authority.

**Information architecture rules:**
- The next-action card headline, status frame, and primary CTA should tell the same story. If Verify is needed, the dominant card should frame Verify as next and keep export availability secondary in the metrics/export summary.
- Mapping truth shown on Project is **read-only**. It shows what Map Pins has saved. The student cannot edit it here.
- Export status (Draft, Trusted, etc.) belongs on Project as a status chip â€” not as the dominant card frame.

**Known friction (current state):**
- **F-P1**: ~~"AVAILABLE EXPORT" label frames the next-action card when the real action is "Continue to Verify" â€” these are contradictory. The card label comes from export state but the CTA points to Verify.~~ **Resolved 2026-05-04** â€” the dominant card now frames Verify as `VERIFY NEXT` and keeps export availability in secondary Project status/summary fields.
- **F-P2**: ~~First-load at "/" renders a black main content area until the user explicitly clicks the Project button.~~ **Resolved 2026-05-03** â€” startup mode now canonicalizes invalid values to `project`, and first-load assertions are enforced for `/` and `/os/`.
- **F-P3**: The board mapping table (full XDC rows) is visible by default below the fold on Project. This is Map Pins territory and adds noise to the dashboard story.
- **F-P4**: "Rails On / Console On" toggles appear at top-right even though Project has no rails or console concept.
- **F-P5**: "Explore examples" secondary CTA next to "Continue to Verify" is an escape path that could overwrite the current project â€” needs destructive action guard.

**Success state definition:**
Show `Project Ready` only when all of:
1. IO mapping is complete (5/5 or equivalent).
2. Verify has a current assertion-backed PASS (Compare checks, not Observe only).
3. A trusted export bundle exists, or the next step is clearly named.

---

### 3.2 Design (Circuit Canvas)

**Role:** Authoring workspace for the circuit graph. Canvas is primary.

**Primary actions:**
1. Add and wire logic on the canvas.
2. Inspect selected or verify-linked elements.
3. Proceed to Verify when the circuit is stable.

**What students should see:**
1. **Left library** â€” Board resources, IO, Logic, Sequential, Reusable. Board expands first so CLK100MHZ is immediately reachable.
2. **Workbench header** â€” Select/Wire tools, Snap/Undo/Redo/Fit/Delete, Canvas/Code/Split mode toggle, Open Verify + Project escape hatches.
3. **Starter banner** â€” contextual orientation card when a starter is loaded. Shows what this circuit is and what to verify next. Expected/behavior summary.
4. **Circuit health row** â€” errors, warnings, drafts, ready-to-build status. Compact.
5. **Canvas (primary)** â€” takes the remaining vertical space. This is where the circuit lives.
6. **Right inspector** â€” idle: DESIGN OVERVIEW (Inputs/Outputs/Nodes/Wires counts). Active: selection context, verify-linked signal inspection.

**Information architecture rules:**
- Canvas must win vertical space. The starter banner and circuit health row are supporting actors.
- The right inspector idle state ("Canvas ready") is the secondary fallback. It should not look like a co-equal panel.
- In code/split mode the library collapses to an overlay rail so it does not reserve constant horizontal width.

**Current state (observed):**
- Design surface renders well. Canvas shows the 2-bit counter circuit clearly.
- Starter banner is helpful and compact.
- Left library is wide by default (shows all Board resources expanded). This is by spec (Board first), but it takes 15-20% of viewport width permanently.
- Right inspector idle copy is verbose.
- No significant layout or rendering issues.

---

### 3.3 Verify (Deterministic Testbench)

**Role:** Deterministic verification engine. Proves the circuit against authored stimulus and expected outputs.

**Primary actions:**
1. Execute a vector run (Observe only or Compare checks).
2. Author clock/stimulus cases in the unified grid.
3. Inspect failure diffs, signal traces, and deterministic hashes.

**What students should see:**
1. **Command bar** â€” Run (primary), Observe only / Compare checks mode selector, Generate starter stimulus, session status.
2. **Stimulus left panel:**
   - Test stimulus header with mode chip and IO summary.
   - Clock/Timing section: board clock identification, auto/manual/custom override.
   - Run summary chips: Inputs, Checks, Cases, Ticks, clock mode.
   - Cases + grid: stimulus rows and expected output rows, one column per test case.
3. **Waveform right panel:**
   - Lane headers for all signals (always visible even before a run).
   - Empty state: "Run Verify to see waveforms" with one-click "Run - observe only" CTA.
   - Post-run: waveform traces per signal, selectable lanes.
4. **Signal rail** (left, collapsible) â€” signal browser.

**Board clock truth (LOCKED â€” do not change):**
- `CLK100MHZ` on `W5` is recognized as a Basys3 board clock, not an ordinary switch lane.
- Auto board clock mode auto-toggles the clock during a run. Students do not author CLK100MHZ pulses by hand.
- Manual pulses and Custom pattern remain available for switch/button-clocked designs.

**Success state definition:**
`Verification PASS` requires:
1. Compare checks mode (not Observe only).
2. Zero failing rows.
3. Stable hash (circuit + vectors + mapping) â€” timestamp-free.
4. Saved checks that authorize Export trust.

**Known friction (current state):**
- **F-V1**: Command bar is information-dense. "Generate starter stimulus | Run | NEXT RUN: Observe only | Compare checks" + right-side "NOT RUN / Observe only / Press Run to r..." (truncated text visible in screenshot) + "READY | SESSION DETAILS". Too much in one row for smaller viewports.
- **F-V2**: "Press Run to r..." text truncates at viewport width. The truncated text loses meaning.
- **F-V3**: "Verify rows On" toggle appears in top-right even when it's a developer tool, not a student-facing control.
- Clock section is clean and correct after 2026-05-03 cleanup.

---

### 3.4 Map Pins / Hardware (Board Binding)

**Role:** Bind circuit signals to physical Basys3 board controls. Editing authority for all pin mappings. Export reads from here; Project shows a read-only mirror.

**Primary actions:**
1. Select a project signal.
2. Choose the matching board control from the diagram or table.
3. Confirm the physical package pin binding.

**What students should see:**
1. **Readiness indicator** â€” "MAPPING COMPLETE" or blocking issue count + what's missing.
2. **3-step guide** â€” only when mapping is incomplete. Should collapse when all signals are mapped.
3. **Board resource legend** â€” compact summary of available categories (System Clock, Slide Switches, Pushbuttons, LED Outputs, 7-Segment Lines) with counts.
4. **Signal table** â€” grouped by CLOCK/RESET and OUTPUTS (and other categories). Each row shows signal name, board binding, package pin, mapping status, EDIT MAPPING button.
5. **Board diagram** â€” visual Basys3 board with highlighted mapped controls.
6. **Right inspector** â€” Mapping Focus (idle: "Ready to map"), Selected Board Control (active: package pin + status), Advanced XDC Preview (collapsed), Mapping Diagnostics (collapsed).

**Information architecture rules:**
- There are currently two top-level card sections: "HARDWARE" (orientation) and "MAP PINS" (work area). These feel like duplicate sections because both describe the same task. The orientation content should be inside the work area card or above it â€” not as a separate peer card.
- Advanced XDC Preview, Mapping Diagnostics, and Preflight Details in the right inspector are technical details. These should be collapsed by default (they are) and labeled clearly as "for instructors / advanced".

**Known friction (current state):**
- **F-H1**: Two card sections ("HARDWARE" and "MAP PINS") create the impression of two separate sub-features. They are the same feature â€” just introduction text + the actual work area. These should be unified.
- **F-H2**: 3-step guide ("1. Select project signal | 2. Choose board control | 3. Confirm binding") persists even when mapping is 100% complete. This is stale guidance occupying prime space.
- **F-H3**: "NEEDS REVIEW" amber chip persists even after mapping is confirmed complete (5/5 mapped). Students get a warning-colored chip with no clear resolution action â€” it may indicate Verify needs to run, but that's not labeled.
- **F-H4**: Left accordion panel text truncates: "Compl..." instead of "Complete". Not visible enough to read.
- **F-H5**: The board diagram appears only when scrolled â€” not in the visible first screen. This is a valuable orientation artifact and should be accessible without scrolling.

---

### 3.5 Export (Vivado Handoff)

**Role:** Compile and package the circuit for Vivado. Final gate in the IDE pipeline. Distinguishes draft artifacts from trusted verified handoffs.

**Primary actions:**
1. Validate export readiness and trust tier.
2. Preview generated artifacts (top.vhd, top.xdc, README, testbench.vhd).
3. Download the Vivado project package.

**Trust tiers (LOCKED â€” do not change):**
| Tier | Meaning |
|------|---------|
| Draft | Structurally valid; no current Verify Compare PASS |
| Trusted | Current Verify Compare PASS + current mapping + current circuit |
| Previous | Built from a prior circuit state; circuit has changed since |

**What students should see:**
1. **Readiness banner** â€” single honest status: READY, NEEDS REVIEW, or BLOCKED. Plus direct fix path if blocked.
2. **Handoff summary** â€” design hash, verification status, build status. One block, not a two-column duplicate.
3. **Primary actions** â€” "Build Current Bundle" when ready, or "Open Verify" as the repair path. "Download Draft Vivado Project" as secondary escape hatch.
4. **Artifact workspace** â€” list of generated files with preview capability.
5. **Right inspector** â€” Kit summary (name, expected behavior), then collapsed: Export Goals, Build/Debug Context, Artifact Checklist.

**Testbench truth (LOCKED â€” do not change):**
- Generated `testbench.vhd` includes a dedicated free-running clock process for detected board clock ports (e.g. `CLK100MHZ` on `W5`).
- Stimulus is sampled against `rising_edge(...)` waits. Students do not write manual clock vectors.
- This matches the Verify behavior exactly â€” the testbench mirrors what the IDE proved.

**Known friction (current state):**
- ~~**F-E1**: The message "Run Verify before relying on this handoff" appears **three times** in a single screen — in the EXPORT card header, the HANDOFF SUMMARY left heading, and the NEXT ACTION right column. This is excessive repetition and undermines the message.~~ **Resolved 2026-05-05** — commit `4a248098`. Summary card now names the current tier (`summaryStateTitle`), next-action dock names the repair action (`nextActionTitleDistinct`), trust consequence gives how-to detail (`nextActionDetailDistinct`).
- ~~**F-E2**: "HANDOFF SUMMARY" and "NEXT ACTION" appear as a two-column layout but contain the same content. The distinction is not clear. One of these should be the primary block; the other should be the action row below it.~~ **Resolved 2026-05-05** — same commit `4a248098`. HANDOFF SUMMARY and NEXT ACTION now derive distinct copy per export condition.
- **F-E3**: "Build: Previous" in the right status column is unexplained jargon. Students cannot tell what action resolves it or why it matters.
- **F-E4**: "NEEDS REVIEW" amber chip appears at top of surface and again in the NEXT ACTION column â€” redundant but consistent color usage.

---

## 4. Cross-Surface Flow Integrity

### 4.1 The canonical student journey

```
Project (readiness review)
  â””â”€ â†’ Design (circuit authoring)
        â””â”€ â†’ Verify (proof: Compare checks PASS)
              â””â”€ â†’ Map Pins (bind signals to board controls)
                    â””â”€ â†’ Export (download Vivado package)
                          â””â”€ â†’ Vivado (external: synth â†’ impl â†’ bitstream)
                                â””â”€ â†’ Hardware Manager (external: program board)
                                      â””â”€ â†’ Board observation (E3 certification)
```

### 4.2 Navigation authority rules

| From | To | Gate |
|------|----|------|
| Project â†’ Design | Always allowed | |
| Project â†’ Verify | Always allowed | |
| Design â†’ Verify | Always allowed | "Open Verify" CTA + rail click |
| Verify â†’ Design | Always allowed | "Open in Design" CTA |
| Verify â†’ Export | Allowed; Export shows NEEDS REVIEW if no PASS | |
| Map Pins â†’ Export | Allowed | "Open Export" CTA |
| Export â†’ Verify | Allowed | "Open Verify" repair CTA |
| Export â†’ Map Pins | Allowed | "Map Pins" CTA in export header |

No surface blocks navigation to another surface. Trust is shown as state (READY / NEEDS REVIEW / BLOCKED) rather than blocking navigation.

### 4.3 Information ownership matrix

| Information | Owned by | Read-only mirror in |
|-------------|----------|-------------------|
| Project name, description | Project | Top bar breadcrumb |
| Circuit graph | Design | Verify (for simulation), Export (for RTL gen) |
| Verify vectors and evidence | Verify | Project (VERIFY chip), Export (trust gate) |
| Pin mappings | Map Pins | Project (read-only table), Export (for constraints) |
| Export artifacts | Export | Project (EXPORT chip) |
| Board target (Basys3) | Global (immutable) | Every surface |

**Rule:** If a surface shows information it does not own, it must be visually read-only and link back to the owning surface for editing. Project violates this only if it allows editing the pin table â€” it does not (confirmed in browser).

### 4.4 Status badge semantics

**Left rail badges:**
- No badge: Project (home, not a workflow step)
- Numeric badge (1, 2, 3, 4): Design, Verify, Map Pins, Export â€” these are **step numbers**, not item counts
- "OK" badge: step is in a complete or passing state
- Step-number badge with no OK: step is accessible but not yet proved complete

**Surface-level status chips:**
- Green "MAPPING COMPLETE", "PASS": positive completion
- Amber "NEEDS REVIEW", "Draft", "Previous": warning state, not blocking
- Red "BLOCKED": hard block, export cannot proceed

---

## 5. Visual System Principles

### 5.1 Color semantics (consistent across surfaces)

| Color | Semantic | Use |
|-------|----------|-----|
| Teal/cyan | Primary action | Run button, Open Verify, primary CTAs |
| Amber/yellow | Warning / needs attention | Draft, Needs Review, VERIFY NEXT |
| Green | Success / complete | PASS, MAPPING COMPLETE, OK badges, Mapped |
| Muted gray | Inactive / informational | Observe-only labels, secondary text |
| Dark background | Always | Surfaces share the same dark IDE background |

### 5.2 Typography hierarchy

1. **Surface headline** (e.g. "Export Needs Review", "Hardware") â€” largest, one per surface
2. **Section header** (e.g. "HANDOFF SUMMARY", "MAP PINS") â€” small caps or uppercase label
3. **Card heading** (e.g. "Run Verify before relying on this handoff") â€” one per card block
4. **Body / description** â€” supporting copy below card heading
5. **Chip / badge** â€” status bits inline with headings or in strips

**Rule:** A surface should have one level-1 story per screen. Multiple competing card headings of equal weight (as in Export currently) break the hierarchy.

### 5.3 Empty state contract

Each surface must have:
1. A clear headline explaining why the surface is empty.
2. One primary CTA that resolves the empty state.
3. One secondary action (optional).

No surface should render a blank/black main region on initial load. (F-P2 resolved 2026-05-03 for Project first-load routes.)

### 5.4 Chrome toggle visibility

The developer toggles (Rails On, Console On, Toolbar On, Verify rows On) are visible in the top-right of the content area on all surfaces. These are debugging chrome, not student-facing controls. In a hardened student-facing pass, these should be:
- Hidden by default for students
- Accessible to instructors/developers via a debug mode or Settings
- Not taking top-bar real estate on surfaces where they have no concept (Project, Export)

---

## 6. Locked Stable Truths

These behaviors are established by gates, browser proofs, and E1/E2 certification. They must not change.

| Truth | Source | Gate |
|-------|--------|------|
| `CLK100MHZ` on `W5` is a Basys3 board clock â€” not a manual switch lane | basys3Pins.ts, VerifySurface.tsx | board-clock-browser-proof.spec.ts |
| Auto board clock mode runs the clock automatically; students do not author CLK100MHZ pulses | simEngine, ScenarioBuilderPanel | board-clock-browser-proof.spec.ts |
| Manual pulses and Custom pattern remain available as explicit override modes | VerifySurface.tsx | Verify unit tests |
| Generated testbench.vhd includes a free-running clock process for CLK100MHZ + rising_edge sampling | exportVHDL.ts | E1 batch logs |
| Export trust tiers: Draft (no PASS), Trusted (current PASS + mapping + circuit) | projectHealth.ts, exportStore | Verify semantic suite |
| Pin mapping authority is Map Pins â€” Project shows read-only mirror | projectWorkflowAuthority.ts | Map Pins surface tests |
| Export is downstream of all other surfaces â€” reads circuit + vectors + mapping | export pipeline | gate: verify:gates |
| Project save/load: project persists as RBProject JSON including circuit, layout, submodules, vectors, mapping | unifiedProjectStore | Project save/load tests |
| Deterministic hash covers: circuit + project vectors + custom vectors + project IO mapping (not UI IDs) | projectHealth.ts | Verify semantic suite |
| CSS: no broad substring selectors in ide-polish-pass.css | pnpm css:audit:ide | css-audit gate |
| Browser surface baselines: all 5 surfaces render coherent landmarks at 1366x768 and 1920x1080 | â€” | ide-surface-baselines.spec.ts |

---

## 7. Open Product Debt (with friction codes from Â§3)

This section maps known friction to debt items for tracking. See `docs/IDE_PRODUCT_DEBT_REGISTER.md` for full register.

### High priority (student-blocking or confusing)

| Code | Surface | Issue | Blocking? |
|------|---------|-------|-----------|
| F-P2 | Project | ~~First-load "/" renders black main content until explicit Project click~~ -> resolved via startup mode canonicalization + first-load route assertions | Closed |
| F-P1 | Project | ~~"AVAILABLE EXPORT" label frames next-action card when action is "Continue to Verify"~~ -> resolved via Verify-first status framing on the dominant Project card | Closed |
| F-E1 | Export | "Run Verify before relying..." repeated 3Ã— in one screen | High â€” undermines message |
| F-V1 | Verify | Command bar over-dense for smaller viewports; status text truncates (F-V2) | Medium |
| F-H3 | Map Pins | "NEEDS REVIEW" chip persists after mapping is complete â€” no clear resolution path | Medium |

### Medium priority (UX friction, not blocking)

| Code | Surface | Issue |
|------|---------|-------|
| F-P3 | Project | Full mapping table visible below fold â€” Map Pins territory, adds noise |
| F-P4 | Project | Rails/Console toggles appear on Project (have no meaning there) |
| F-H1 | Map Pins | Two card sections ("HARDWARE" + "MAP PINS") feel like duplicate feature descriptions |
| F-H2 | Map Pins | 3-step guide persists when mapping is 100% complete |
| F-E2 | Export | "HANDOFF SUMMARY" + "NEXT ACTION" two-column layout has redundant content |
| F-E3 | Export | "Build: Previous" is unexplained jargon |

### Low priority (polish / debug chrome)

| Code | Surface | Issue |
|------|---------|-------|
| All | Global | Developer toggles (Rails/Console/Toolbar/Verify rows) visible in student-facing surfaces |
| F-H4 | Map Pins | Left accordion text truncates ("Compl...") |
| F-H5 | Map Pins | Board diagram only visible when scrolled |

---

## 8. Next Implementation Slices

These slices are ordered by student impact. They are **proposals only** â€” each requires a browser proof gate before closure. No implementation should start without re-reading this document and the corresponding surface spec.

### Slice 1 â€” Fix first-load Project black screen (F-P2) â€” **Done 2026-05-03**
**What:** When navigating to `/`, the Project surface main content is invisible until the user explicitly clicks "Project" in the left rail.
**Fix:** Implemented startup mode canonicalization (`normalizeIdeMode`) in `startupMode.ts` + `IdeApp.tsx`, with first-load guard assertions for `/` and `/os/` in `tests/e2e/ide-surface-baselines.spec.ts`.
**Gate:** Browser proof passed: `/` and `/os/` at 1366x768 and 1920x1080 with clean-storage and saved-project restore paths.

### Slice 2 â€” Unify Project next-action card (F-P1) â€” **Done 2026-05-04**
**What:** Remove the "AVAILABLE EXPORT" framing label from the next-action card when the action is "Continue to Verify". The card title should be the action, not the status of an unrelated surface.
**Fix:** `ProjectSurface.tsx` now gives the dominant next-action card Verify-first framing when the required next step is Verify: status label `VERIFY NEXT`, supporting line pointing to Verify before Export/hardware reliance, and no export-availability framing in the card chrome itself.
**Gate:** `projectSurface.continuity`, `projectSurface.submission`, and `ideApp.labday-wiring` pass; `pnpm ide:gate:project-overview-contract`, `pnpm ide:gate:project-readiness-contract`, and `pnpm ide:gate:project-continue-cta-contract` pass.

### Slice 3 â€” Deduplicate Export messaging (F-E1, F-E2)
**What:** "Run Verify before relying on this handoff" should appear once per screen. Merge HANDOFF SUMMARY and NEXT ACTION into a single block: status + one primary action + one secondary action.
**Effort:** Medium â€” component restructuring in ExportSurface.
**Gate:** Browser proof. CSS audit. Playwright baselines.

### Slice 4 â€” Collapse Map Pins 3-step guide when complete (F-H2)
**What:** The 3-step guide ("Select project signal â†’ Choose board control â†’ Confirm binding") should be collapsed or hidden when all required signals are mapped (MAPPING COMPLETE state).
**Effort:** Small â€” conditional render on mapping completeness.
**Gate:** Browser proof with 5/5 mapped. Manual test with partial mapping to confirm guide still shows.

### Slice 5 â€” Clarify "NEEDS REVIEW" on Map Pins and Export (F-H3)
**What:** When "NEEDS REVIEW" persists after mapping is complete, the chip should explain what needs review. Likely: "Verify needs a fresh run to trust this mapping." The chip should link directly to Verify or include the fix path inline.
**Effort:** Small â€” copy + CTA.
**Gate:** Browser proof confirming chip explains itself.

### Slice 6 â€” Hide dev chrome toggles from student surfaces (Global)
**What:** Rails/Console/Toolbar/Verify-rows toggles should not be visible on all surfaces by default. Gate them behind a dev/instructor mode or collapse them to a single "Dev tools" button.
**Effort:** Medium â€” requires a dev mode toggle mechanism.
**Gate:** Browser proof confirming clean surfaces. Ensure all existing toggle tests still pass (tests use DOM queries not visual state).

---

## 9. Validation Baseline (at time of this document)

All gates must pass after any future implementation slice:

```
pnpm css:audit:ide              # Exit 0 (warnings OK, hard fail on broad substring in polish)
pnpm -w exec vitest run         # 23+ unit tests + 33+ semantic suite passing
pnpm -w exec playwright test tests/e2e/ide-surface-baselines.spec.ts   # 2/2
pnpm -w exec playwright test tests/e2e/board-clock-browser-proof.spec.ts  # 1/1
```

CSS audit state to preserve:
- Exit 0
- Warnings only: overlap 10 (baseline 5, warning threshold), 2 broad substring in root (legacy)
- No broad substring selectors added to polish

Commit hash at time of this document: see `AI_STATE.md` Change Log for current HEAD.

---

*This document supersedes informal UX notes and per-session audits. For surface-level specs, see `docs/ide/0N-*.md`. For debt register, see `docs/IDE_PRODUCT_DEBT_REGISTER.md`. For active implementation work, see `docs/ACTIVE_WORK.md`.*
