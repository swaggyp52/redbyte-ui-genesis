# Product Hardening Ticket: Project / Map Pins / Hardware Mapping Legitimacy (Trust & Workflow)

## Ticket

- Title: Project Map Pins legitimacy — discoverability, classification, and export-aligned messaging
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Project (Map Pins section), workflow spine (Verify → Project → Export)
- Journey segment: After mapping/export **authority** fix — student-facing clarity and trust on top of correct state
- Mode: Student (first-time lab machine)
- Environment:
  - Fresh machine / clean browser profile: targeted (Playwright + local dev server as available)
  - OS: Windows
  - Browser: Chromium / Edge
  - Node / pnpm: per repo toolchain
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - Mapping state is now authoritative after the 2026-04-21 resync fix, but the **Project → Map Pins** experience can still feel compact, visually weak, and easy to misunderstand.
  - The mapping block can read like a collapsed utility rather than a **first-class pipeline step** between Verify and Export.
  - Required vs optional vs invalid pins are not always obvious at a glance; role hints (clock, reset, data in/out) are generic table rows.
  - After editing a pin, there is little immediate confirmation that the project record (and thus Export) will see the same truth.
- Expected behavior:
  - A student who verified a clocked design can open **Project**, **instantly** see whether mapping is complete / incomplete / invalid, which rows need action, and how that lines up with **Export readiness** using the **same language** as the mapping table.
  - Interactive rows look editable; non-exportable / structured rows do not masquerade as simple scalar pin edits.
- Why this matters:
  - Correct data with a confusing UI still fails the classroom: students blame the tool and lose trust in the build → verify → map → export story.
- Severity: SEV-2 workflow / trust (post-authority)

## Reproduction

- Exact repro steps (post-authority baseline):
  1. Load a nontrivial design (e.g. clocked sequential lab or renamed ports after design edits).
  2. Run **Verify** successfully.
  3. Open **Project** and scroll to **Map Pins** / mapping section.
  4. Observe: section discoverability, row clarity (required vs optional), role recognition, feedback after pin edit, alignment with Export messaging.
  5. Open **Export** and confirm messaging matches mapping completion (no duplicate authority bug — separate ticket fixed).
- Reproducibility: always (UX inspection)
- First known version or date: 2026-04-21 (follow-on to mapping authority ticket)

## Evidence

- Screenshot / recording: capture after implementation (mapping header, role cues, confirmation strip)
- Test / gate output: targeted Vitest for Project mapping UI; optional manual pass on `localhost` IDE
- Additional artifacts: this ticket, prior authority ticket `product-hardening-ticket-2026-04-21-project-mapping-export-authority.md`

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md`
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`

## Acceptance Proof

- Minimum acceptance proof:
  - Map Pins section has explicit title + pipeline context (Verify → map → Export).
  - Mapping completion / gaps are obvious **without** opening a collapsed panel by default when a circuit is loaded (or equivalent strong discoverability).
  - Rows that need action are visually distinct; optional vs required is explicit; invalid pins are clearly marked.
  - Clock / reset / timing-role cues appear where metadata or live schedule roles exist.
  - Changing a scalar pin shows **immediate** confirmation tied to project persistence (not vague).
  - Export readiness copy in the mapping block aligns with `exportSummary` / workflow truth.
  - At least one focused automated test covers the new behavior (strings / testids / row classes).
- Required test / gate command(s):
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectSurface.mapping-legitimacy.test.tsx` (or merged existing test file if consolidated)
- Required manual proof:
  - Simple design; renamed clocked design; one invalid / optional / non-scalar row as available in fixtures
- Screenshot or recording expectation: mapping section visibly “first-class” and self-explanatory

## Docs Review

- Docs that must be reviewed if behavior changes: `docs/IDE_SYSTEM_MAP.md`, `AI_STATE.md`
- Docs that must be updated if behavior changes: only affected truth docs (minimal)

## Disposition

- Status: fixed
- Fix PR / commit: pending
- Notes:
  - Builds on mapping/export **authority** fix (hardwareMappingV2 resync). This slice is **UX + messaging + classification only** on top of that baseline.
  - Implemented: Map Pins section header + export-readiness mirror; default-expanded mapping table; required/optional badges; role tags (`timingRole` + verify-schedule `deriveIoSignalRoles` via `ioSignalRolesByLabel`); row emphasis (`ide-project-map-row--*`); structured non-scalar rows read-only; post-verify incomplete-mapping callout; persistence confirmation strip after pin edit; `IdeDataTable` row class hook; regression tests in `projectSurface.mapping-legitimacy.test.tsx`.

## Attribution

Connor Angiel
