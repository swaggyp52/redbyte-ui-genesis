# Product Hardening Ticket: Hardware / Board Mapping Coherence + Real Student Flow Proof

## Ticket

- Title: Hardware board-mapping coherence with Project + runtime proof of Verify → Map → Hardware → Export
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Hardware (`HardwareSurface.tsx`) + cross-surface mapping pipeline (Project, Export)
- Journey segment: Verify → Project (Map Pins) → Hardware → Export
- Mode: Student lab machine
- Environment: localhost dev server (`pnpm dev` / playground), Chromium

## Problem

- Observed behavior:
  - Project Map Pins was improved for legitimacy; Hardware / board views may still feel second-class, ambiguous, or not clearly “same truth” as Project.
  - Students need confidence that pin assignments edited on Project appear identically on Hardware and in Export without split authority or confusing duplicate editors.
- Expected behavior:
  - One coherent mental model: **Project owns authoritative pin table for student edits**; Hardware reflects that truth for board bring-up, timing, and checklist—without implying a parallel competing editor unless intentional and labeled.
  - Renamed clock-like ports remain understandable end-to-end after Verify.
- Severity: SEV-2 trust / classroom workflow

## Reproduction (required runtime)

- Flow A: simple ports → verify → Project map pin change → save feedback → Hardware + Export reflect same pins.
- Flow B: clocked starter (e.g. two-bit-counter) → rename clock-like port → verify → map on Project → Hardware + Export alignment.
- Flow C: structured / non-scalar row → UI explains honestly (no fake broken pin field).

## Evidence

- Playwright E2E: `tests/e2e/ide-mapping-pipeline-coherence.spec.ts` (Chromium against `vite preview` on `127.0.0.1:4173`).
- Screenshot: `artifacts/ide-mapping-pipeline-coherence-flow-a-export.png` (Export surface after Project pin edit + pipeline proof).
- Vitest: `hardwareSurface.readiness.test.tsx` (Project authority callout), plus mapping-authority + Project mapping legitimacy suites re-run.

## Truth Sources

- `docs/IDE_SYSTEM_MAP.md`, `docs/contracts/RedByte_Product_Contract.md` (as relevant)

## Acceptance Proof

- Real localhost replay completed and documented (Playwright against preview server — production bundle path).
- Project vs Hardware authority is explicit: Hardware Map Pins stage shows `ide-hw-map-authority-callout` + **Open Project — Map Pins**; dock uses the same CTA when mapping incomplete.
- Mapping-authority + legitimacy + Hardware readiness tests pass.

## Disposition

- Status: fixed
- Notes:
  - **Authority**: `IdeApp` passes `onGoToProject` into `HardwareSurface` so board flow can route back to the authoritative Project Map Pins table. Hardware copy states that board quick-assign and Project typing share the same project state.
  - **Structured IO**: `ide-hw-structured-authority-note` prefixes the advanced V2 editor with explicit “prefer Project; use here for bus/bit or Export repair” language.
  - **E2E**: Flow A (signal-tour pin change propagates to Hardware row + Export body text); Flow B (two-bit-counter CLK row on Hardware Map Pins tab). Map Pins tab is required because default Hardware stage may be **Test on Board** when mapping is already complete.

## Attribution

Connor Angiel
