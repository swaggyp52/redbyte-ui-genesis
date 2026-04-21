# Product Hardening Ticket: Verify Surface Legitimacy + Post-Verify Workflow Continuity

## Ticket

- Title: Verify surface student-legitimacy, hierarchy, and post-verify continuity (Project / Map Pins / Hardware / Export)
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Verify (`VerifySurface.tsx`, `VerifyCommandBar`, `VerifyPrimaryStatusArea`, `ide-root.css` as needed)
- Journey segment: Design → Verify → (failure path / pass path / pass-with-incomplete-mapping) → Project, Hardware, or Export
- Mode: Student lab machine
- Environment: localhost dev / `vite preview` (Playwright), Chromium

## Problem

- Observed behavior:
  - RedByte is more correct underneath, but Verify still read as a dense, developer-style panel: status vs evidence vs “authoritative” copy competed, and the primary pass CTA for **incomplete pin mapping** incorrectly routed to **Hardware** with **Map Pins** labels — contradicting the accepted model (Project is the student-facing mapping editor).
- Expected behavior:
  - At a glance: overall status, what was checked in plain product language, pass vs fail vs incomplete vs warning, and **one clear next action** (Design vs **Project — Map Pins** vs Hardware bring-up vs Export) without internal jargon in the main read path.
- Severity: SEV-2 trust / classroom workflow

## Reproduction (required runtime)

- **Flow A (pass, mapping complete)**: load known-good starter/vectors → run Verify → confirm success hero, **Continue to Hardware** + **Open Export** (when wired), and student-readable trust copy.
- **Flow B (fail)**: run against intentional mismatch or broken checks → failure legible, diagnosis header student-framed, **Inspect first mismatch** / Design path obvious.
- **Flow C (pass with incomplete mapping)**: pass + `incomplete-mapping` (unmapped outputs) → primary CTA is **Open Project — Map Pins**; Hardware optional as “same mapping”; not mislabeled as the primary typing surface.

## Evidence

- Vitest: `verifySurface.workstation.test.tsx`, `verifyCommandBar.actionRowHierarchy.test.tsx` (inline **Use saved checks**), mapping-authority regression re-run.
- Playwright: `tests/e2e/verify-surface-legitimacy-proof.spec.ts` → `artifacts/verify-surface-hardening-2026-04-21-workspace.png` (full-page Verify after a run on preview). Pass-hero + compare CTAs are additionally locked by workstation unit tests (starters in preview do not always ship with pre-authored expected cells without an oracle / compare subflow in automation).

## Truth Sources

- `docs/IDE_SYSTEM_MAP.md`, `docs/contracts/RedByte_Product_Contract.md` (as relevant)
- Prior accepted truth: **Project → Map Pins** is authoritative; Hardware reflects + quick-assign; Export consumes the same mapping.

## Acceptance Proof

- Runtime replay shows concrete student-facing improvement: CTA and copy align with the mapping model; hierarchy does not require reading hashes to understand outcome.
- Tests green for touched modules; mapping-authority suites re-run if shared paths are touched (not expected for copy/CTA-only Verify edits).

## Disposition

- Status: fixed (slice complete for targeted Verify legitimacy + compare discoverability; deeper visual polish can follow)
- Notes: Root issues addressed — **wrong CTA to Hardware** for **Map Pins** on pass+`incomplete-mapping`, **redundant** pre-run mapping strip vs command-bar callout, **opaque** “Authoritative” copy, **failure** header phrasing, **hidden** “Use saved checks” when no Tools menu, **duplicate** command-bar + pass-hero mapping messages on the same run.

## Attribution

Connor Angiel
