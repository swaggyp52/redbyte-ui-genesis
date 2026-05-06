---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: v1 readiness gate — honest checklist of what is done, in-progress, and blocked
---

# RedByte v1 — Release Readiness Checklist

**Last updated:** 2026-05-05
**Honest posture:** RC1 (frozen 2026-04-23). Core student workflow proven. Visual and pilot readiness not yet complete.

Key: `[x]` = done and verified · `[~]` = partially done or in-progress · `[ ]` = not done · `[!]` = known blocker

---

## A. Product Readiness (Core Workflow)

- [x] Student path Design → Verify → Export → Vivado works end-to-end for combinational circuits
- [x] Student path works end-to-end for single-clock rising-edge sequential circuits (two-bit-counter)
- [x] Sequential boundary enforcement: falling-edge, multi-clock, active-low reset blocked in Verify and Export
- [x] Design-time circuit health feedback: combinational loops, multiple drivers, floating outputs detected inline
- [x] Export trust/draft label is honest (Export surface does not offer Trusted Export when Verify is stale)
- [x] Board-clock (CLK100MHZ / W5) auto-detected in Verify and driven correctly in exported VHDL
- [x] Import navigates to Design after successful project import
- [x] Deterministic simulation: same circuit + same vectors = same results
- [x] Cross-artifact consistency check passes (testbench ports match entity ports)
- [x] README accurately describes the current product (overclaims removed 2026-04-01)
- [x] Product manual contains zero known overclaims (claim audit + traceability matrix current)
- [ ] Final E3 observation for `golden-basys3-switch-and` (four-case manual note still pending after 2026-05-05 controlled E2 refresh)
- [ ] `two-bit-counter` E3 (TA checklist on hardware still pending after 2026-05-05 controlled E2 refresh)

---

## B. UX Readiness

- [x] Project surface: breadcrumb, project metadata, workflow rail all consistent
- [x] Verify surface: compact stimulus strip, collapsible guidance, waveform empty-state placeholder
- [x] Export surface: trust/draft hero, 8-step Vivado checklist, collapsed previews
- [x] Hardware surface: calmer no-selection inspector, collapsed advanced details, explicit board task framing
- [x] CSS audit gate wired: `pnpm css:audit:ide` blocks broad substring selector regressions
- [~] Project next-action card: "AVAILABLE EXPORT" framing when action is "Continue to Verify" — F-P1 friction (known, not blocking)
- [~] Developer chrome (Rails/Console/Toolbar toggles) visible on Project surface — F-P2 / RB-DEBT-012 (known, not blocking)
- [ ] All surfaces pass the "screenshot-worthy" bar (full visual freeze not yet done)
- [ ] No embarrassing empty states on any surface in the canonical student path (not audited end-to-end)

---

## C. Example / Learning Path Readiness

- [x] `signal-tour`: E1 + E2 + E3 — fully certified (board behavior confirmed 2026-04-29)
- [x] `golden-basys3-switch-and`: E1 + E2 refreshed in controlled 2026-05-05 bench; E3 pending four-case note
- [x] `two-bit-counter`: E1 + E2 refreshed in controlled 2026-05-05 bench; E3 pending TA checklist
- [x] From-scratch combinational: E1 + E2 (fs-comb-switch-and-basys3)
- [x] From-scratch sequential: E1 + E2 (fs-seq-two-bit-counter-basys3)
- [x] Custom project shapes: E1 proven (fs-custom-four-switch-led, fs-custom-mixed-gate-chain)
- [~] Lab starters (lab1–lab8): L0/E0 only — not E1-certified; labeled honestly in release readiness doc
- [ ] Each starter example has student-facing learning goal copy
- [ ] Each starter example has "what this proves" and "what to try next" copy
- [ ] v1 guided learning path (Basic Gates → Counter → FSM) curated with copy

---

## D. Verification / Export Readiness

- [x] Post-Vivado bench evidence classifier is live (`rb:bench:evidence:classify`) and keeps E1/E2/E3 separated
- [x] Target observation template workflow is live (`rb:bench:evidence:observe`) with explicit `can_promote_to_E3` gate
- [x] Export surface now shows a compact Vivado evidence diagnostics ladder so E0 package generation, E1 build/bitstream, E2 programming, and E3 observed behavior are not conflated
- [x] Vivado Kit ZIP passes E1 (synth + impl + bitstream) for golden, signal-tour, two-bit-counter, from-scratch twins
- [x] XDC uses correct Basys3 package pin names (traced to Digilent master XDC)
- [x] `create_clock` constraint present and correct for CLK100MHZ / W5
- [x] Draft/Trusted Export distinction enforced in UI and export service
- [x] Export preview = ZIP bytes (single codepath)
- [ ] `build:unified` root `dist/` verification — Windows directory lock issue (known blocker, workaround exists)

---

## E. Import / Proof-Bundle Readiness

- [x] Import navigates to Design on success (import-navigates-to-design.test.tsx: 1/1 pass)
- [x] Import does not crash on valid `.rbx.zip` proof bundle
- [~] VHDL import fidelity reporting — partial fidelity accepted for v1; full fidelity is post-v1
- [ ] Full import round-trip (export → re-import → re-verify) not yet formalized as E-level proof

---

## F. Website / README Readiness

- [x] README rewritten — no OS-era or overclaimed features
- [ ] Website (redbyteapps.dev) has current product description, not stale copy
- [ ] Website has screenshot or GIF of the live product
- [ ] Website has clear "open the IDE" CTA
- [ ] Website has setup instructions (Vivado 2024.2 prerequisite, Basys3 required for hardware path)
- [ ] Website has known limitations section
- [ ] First-run in-app onboarding: student opening the IDE for the first time has a clear "start here" path

---

## G. University Pilot Readiness

- [x] Instructor quickstart materials exist in repo (`docs/INSTRUCTOR_QUICKSTART.md`)
- [x] TA spot-check materials exist in repo
- [x] Lab-day readiness doc exists (`docs/lab-day-vivado-basys3-readiness.md`)
- [~] Classroom demo script exists but references OS-era framing — needs update
- [ ] Clean-tree classroom signoff (instructor or TA walks full workflow from clean browser)
- [ ] Live Basys3 classroom rehearsal (not just bench certification — actual lab environment)
- [ ] Professor-facing one-page pitch (current; OS-era `PROFESSOR_BRIEF.md` is stale and must not be used)
- [ ] 10-minute demo script (current; for use in a faculty meeting or pilot conversation)

---

## H. Known Blockers (RC1 posture)

| Blocker | Why | Unblock by |
|---------|-----|-----------|
| `golden` E3 + custom row E3 | Requires manual board observation | Connected bench session |
| `two-bit-counter` E3 | TA checklist §3 on hardware | Connected bench session |
| `build:unified` `dist/` lock | Windows directory lock after merge | Identify locking process; harden build handoff |
| Clean-tree classroom signoff | Not yet rehearsed | Schedule with instructor or TA |
| Website current copy + demo assets | Not yet updated or captured | After product spine stable (this doc set) |
| Professor pitch / demo script | OS-era doc is stale | University pilot plan (this doc set) |
| Guided learning path copy | Starters exist but have no learning-goal text | Curation pass after examples certified |
