---
doc_status: current
last_validated: 2026-06-12
owner: Connor Angiel
used_by_claude: true
role: compact product issue routing index from whole-app immersion audit
---

# RedByte Product Issue Index

Source audit: `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`
Feature inventory: `docs/audits/2026-06-12-redbyte-feature-inventory.md`
Roadmap: `docs/plans/2026-06-12-redbyte-product-hardening-roadmap.md`

This is a routing index, not a replacement for the audit. Use one issue per implementation slice unless a direct dependency is proven.

## Current Work Order

1. Verify fail-edit-repair regression.
2. Broader student workflow browser suite.
3. Vivado/Basys3 proof restoration.
4. Student and instructor quickstarts.
5. Commercial packaging later.

## Issue Index

| ID | Severity | Surface | Problem | Student impact | Recommended fix | Likely files | Proof/gate needed | Status |
|---|---|---|---|---|---|---|---|---|
| RB-UX-001 | P1 | Project | Fresh first-launch Project path can push the dominant starter/start CTA below the first viewport. | New students may not see the correct next action in the first 10 seconds. | Compress/reorder Project launch so identity, recommended path, and primary start CTA are visible at 1366x768. | `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx`; `packages/rb-apps/src/apps/ide/components/ProjectOverviewPanel.tsx`; `packages/rb-apps/src/apps/ide/ide-root.css` | `ide:gate:ece141-first-viewport`; product immersion/browser proof; docs/encoding checks. | Fixed 2026-06-12 |
| RB-UX-002 | P1 | Design | Starter Design first viewport hides or de-emphasizes the circuit graph behind chrome, palette, health, banner, and inspector content. | Students cannot immediately inspect what loaded or where circuit work happens. | Make the canvas/graph visibly primary while keeping palette, health, and inspector supportive. | `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`; `packages/rb-apps/src/apps/ide/ide-root.css` | `ide:gate:ece141-first-viewport`; `ide:gate:design-workbench-contract`; `ide:gate:design-fit-contract`; browser proof. | Fixed 2026-06-12 |
| RB-UX-003 | P1 | Hardware / Map Pins | First viewport hides board/table mapping work and can show cramped left-rail copy. | Students cannot see the real board-binding task or confirm mapped state. | Promote mapping rows and Basys3 board affordance into first viewport; simplify no-selection guidance. | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`; `packages/rb-apps/src/apps/ide/surfaces/hardware/HardwareSurfacePrimitives.tsx`; `packages/rb-apps/src/apps/ide/ide-root.css` | `ide:gate:ece141-first-viewport`; `ide:gate:ece141-hardware-visual-credibility`; browser proof. | Fixed 2026-06-12; visual credibility guard added 2026-06-12 |
| RB-UX-004 | P1 | Export | Primary export/download/repair action can sit below the first viewport. | Students reach the handoff surface but cannot immediately see what to do next. | Move or duplicate the primary action into the first viewport while keeping E0/E1-E3 language honest. | `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`; `packages/rb-apps/src/apps/ide/surfaces/export/ExportSurfacePrimitives.tsx`; `packages/rb-apps/src/apps/ide/ide-root.css` | `ide:gate:ece141-first-viewport`; `ide:gate:export-download-contract`; product immersion export flows. | Fixed 2026-06-12 |
| RB-UX-005 | P1 | Export / workflow rail | Export hero can say Ready to Build while the lab-flow rail says Export Draft. | Contradictory readiness language weakens trust at the Vivado handoff. | Use one current trust state and keep Draft versus Trusted vocabulary consistent across rail, hero, and CTA. | `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`; `packages/rb-apps/src/apps/ide/workflowStages.ts`; `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx` | `ide:gate:ece141-first-viewport`; product immersion export flows; no E1/E2/E3 overclaim. | Fixed 2026-06-12 |
| RB-VERIFY-001 | P1 | Verify | Fail-edit-repair flow can strand stale/running or disabled state after intentionally editing an expected output and trying to repair it. | Students can lose trust in the debugging loop after making the correct repair. | Add a focused regression first; then fix only the state transition needed to reach terminal PASS/FAIL after repair. | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`; `packages/rb-apps/src/apps/ide/projectRuntime.ts`; Verify primitives/helpers | Browser regression: pass -> flip expected -> FAIL -> restore expected -> rerun -> PASS with enabled controls. | Open |
| RB-VERIFY-002 | P2 | Verify | Verify deck/status text can truncate or crowd the run-mode and session state. | Students may miss whether they are observing, comparing, stale, or ready. | Tighten run deck copy/layout without changing verification semantics. | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`; `packages/rb-apps/src/apps/ide/surfaces/verify/VerifySurfacePrimitives.tsx`; `packages/rb-apps/src/apps/ide/ide-root.css` | Verify layout screenshot/gate at 1366x768; existing Verify contract gates. | Open |
| RB-WAVE-001 | P2 | Verify waveform | Waveform area is credible but crowded in common laptop viewport. | Debugging is harder because signal/tick evidence competes with surrounding chrome. | Improve waveform density/framing after first-viewport repair, preserving tick lock-step. | `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`; `packages/rb-apps/src/apps/ide/ide-root.css` | Waveform screenshot proof and existing waveform/tick-lock gates. | Open |
| RB-HW-001 | P1 | Project / workflow status | No-circuit state can say `Mapping 0 missing`, which sounds like an error before a circuit exists. | First-time students may think they are already blocked by mapping. | Use neutral no-circuit copy until there are top-level signals that actually require mapping. | `packages/rb-apps/src/apps/ide/projectWorkflowAuthority.ts`; `packages/rb-apps/src/apps/ide/workflowStages.ts`; `packages/rb-apps/src/apps/ide/surfaces/ProjectSurface.tsx` | Clean first-launch screenshot and workflow-authority test for no-circuit state. | Open |
| RB-IMPORT-001 | P2 | Import | Import is visible and smoke-tested but not sufficiently proven across real Vivado ZIP/HDL fidelity cases. | Instructors cannot yet rely on broad import recovery without manual verification. | Keep Import as a utility; expand representative ZIP/HDL/corrupt-package proof after first-viewport and Verify repair. | `packages/rb-apps/src/apps/ide/surfaces/ImportSurface.tsx`; `packages/rb-apps/src/import/**`; import tests | `ece141-import-export-recovery.spec.ts` plus representative good/corrupt import cases. | Open |
| RB-ENV-001 | P2 | Runtime environment | Repo pins Node 20.19.0, but recent local proof ran under Node 24.15.0. | Artifact determinism claims remain slightly weaker until pinned-runtime proof exists. | Re-run relevant artifact/doc/browser gates under Node 20.19.0 when available; label Node 24 evidence honestly. | `.nvmrc`; `package.json`; docs cockpit | `node -v` shows 20.19.0, then relevant focused gates pass. | Open / environment-gated |
| RB-HWPROOF-001 | P1 | Vivado / Basys3 proof | Vivado 2024.2 was absent on this desktop; no fresh E1/E2/E3 proof was produced. | Hardware-readiness claims cannot be renewed from this machine. | Restore Vivado/Basys3 proof only on a machine with Vivado 2024.2 and board access. | `docs/STUDENT_RELEASE_READINESS.md`; `docs/release/vivado-basys3-certification-matrix.md`; proof docs/scripts | E1/E2/E3 proof docs/logs and observation notes; no screenshots-only claim. | Open / hardware-gated |
| RB-COMM-001 | P2 | Commercial readiness | RedByte is not ready for unsupervised paid classroom deployment. | Universities would need more support, proof, quickstarts, and deployment clarity before depending on it. | Keep commercial packaging after UX hardening, proof restoration, and quickstarts; defer SaaS. | `docs/product/RED_BYTE_COMMERCIALIZATION_READINESS.md`; release/readiness docs | Commercial readiness checklist reviewed after product hardening and rehearsal proof. | Open |
| RB-DOC-001 | P2 | Student/instructor docs | Student and instructor quickstarts are missing as current public-facing package docs. | Instructors cannot assign RedByte cleanly without Connor/agent context. | Write concise Student First Lab and Instructor Setup/Support quickstarts after first-viewport and proof posture stabilize. | `docs/course/**`; `docs/product/**`; `docs/STUDENT_RELEASE_READINESS.md` | Docs validation; manual walkthrough using only public-facing docs. | Open |

## Non-Negotiables

- Do not mix Verify state repair with broad layout, Export, Hardware, Vivado, or commercial packaging work unless a direct dependency is proven.
- Do not change simulation, export generation, VHDL, XDC, or project data semantics in layout-only slices.
- Do not update goldens or screenshots as a substitute for explaining behavior.
- Screenshots prove layout. Tests prove behavior. Vivado/hardware runs prove downstream handoff.
- Accounts/SaaS stay deferred until a real hosted-data or classroom-management need exists.
