# RedByte agent operating guide

## Product and authority

RedByte is an FPGA educational IDE: Project -> Design -> Simulate -> Board & Constraints ->
Build & Export. Internal route IDs remain project/design/verify/hardware/export; import is a utility.
Basys3 is xc7a35tcpg236-1; Vivado target is 2024.2. Board programming is an external handoff.
Use this checkout unless the user selects another. The old OneDrive RedByte FPGA clone is historical.
Current user instructions govern task scope. Current code/tests establish runtime behavior;
AI_STATE.md and docs/ACTIVE_WORK.md record status and evidence, not immutable release truth.

## Startup and context

Inspect branch/status and read the newest complete status section of AI_STATE.md and
docs/ACTIVE_WORK.md. They are large chronological records: search older entries only as needed.
Never load the entire AI_STATE.md or all architecture/history documents for a routine edit.
docs/DOC_INDEX.md is an on-demand router. CLAUDE.md imports this guide; do not reread it in Codex.
Read docs/ai-usage-rules.md for contribution/validation rules and docs/legal-attribution.md
when editing attribution. Reference Connor Angiel only; no trademark claims or prohibited boilerplate.
For product work, read the relevant portions of docs/contracts/RedByte_Product_Contract.md,
docs/manuals/RedByte_Product_Manual.md and the affected docs/ide surface spec.
For multi-surface architecture, use docs/IDE_SYSTEM_MAP.md and docs/ide/SURFACE_CONFORMANCE.md.
For release/FPGA changes, consult docs/STUDENT_RELEASE_READINESS.md and the applicable proof checklist.
Use product current-truth/work-queue docs when choosing priorities. Historical 00-canon/OS-era docs
do not override current source/contracts; docs/DOC_INDEX.md identifies stale zones.

## Commands and environment

- Node is pinned by .nvmrc to 20.19.0. Label validation under a different runtime.
- Use the pnpm workspace; never npm install. Use corepack pnpm when the shim is unavailable.
- Development: corepack pnpm dev. Browser URLs/ports must come from the actual server output.
- Focused tests: corepack pnpm -w exec vitest run <test-path>.
- Source/gate changes: relevant focused tests and corepack pnpm verify:gates.
- App/shared-package changes: affected package/boundary checks and corepack pnpm build:unified.
- Docs-only: git diff --check; corepack pnpm rb:doc:validate; corepack pnpm rb:encoding:check.
- Keep golden hashes and baseline diagnostics intact; investigate failures under the pinned runtime.

## Invariants

- Keep the modular monorepo, TypeScript strictness, and pure testable logic contracts.
- Canonical connections: { id, from: { nodeId, portName }, to: { nodeId, portName } }.
  Flat fromNodeId/toNodeId fixtures are invalid.
- Deterministic simulation/export identities: no wall-clock timestamps or random IDs in hashes.
- Basys3 ports must match XDC names: SW{N}, LD{N}, BTN{N}, CLK100MHZ.
- TS/TSX is source of truth. Keep existing JS mirrors 1:1 or thin re-export wrappers when touched;
  resolution can prefer JS. Do not introduce a second state/evidence authority.
- Preserve project, run, signal, tick, sample, pin-mapping, export, and persistent-storage semantics.
- Source and local browser proof do not establish Vivado, programming, or physical-board acceptance.

## Frontend and on-demand skills

Read the applicable .agents/skills playbook only when its task matches:
redbyte-frontend-surface-builder and redbyte-design-direction for UI implementation;
redbyte-browser-proof for browser evidence; redbyte-interaction-affordance-review and
redbyte-visual-product-review for requested reviews; redbyte-test-strategy for gate selection;
redbyte-resident-steward for stewardship; redbyte-github-ops for authorized remote delivery.
Obsidian notes and redbyte-obsidian-brain are optional working context, never canonical authority.
Shared product-frontend-quality and Vercel React guidance supplement existing product decisions.
Use fresh browser contexts for storage tests; do not clear the user's existing IndexedDB.
Setup details and rollback are in docs/agent-setup.md; they are not mandatory per-task context.

## Delivery

Preserve all pre-existing uncommitted work. Make small reversible changes and stage only your slice.
Translate substantive product complaints into the existing hardening-ticket fields when useful.
Update the current state/cockpit or affected spec when behavior, evidence, or priorities change;
keep factual change history without duplicating long reports after every action.
Run required gates and distinguish old failures from regressions. Never rebaseline to hide failure.
For authorized Git delivery, verify checkout, intended branch/base, remote, deltas, tests and status;
never force push or modify remotes without instruction. Main can trigger production deployment.
Do not infer commit, push, merge, deployment, or hardware authority from a historical campaign.
For this setup task, changes stay local and uncommitted. Report exact delivery/evidence boundaries.
