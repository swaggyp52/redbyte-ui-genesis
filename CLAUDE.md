# RedByte - Agent Operating Manual

RedByte is an FPGA educational IDE. Project is the dashboard/home surface; students then design circuits, verify behavior against test vectors, bind ports to Basys3 resources in Map Pins / Hardware, and export Vivado-ready packages. Primary package: `packages/rb-apps`. Target hardware: Basys3 (`xc7a35tcpg236-1`). Vivado target: 2024.2.

The canonical product hierarchy is: Project -> Design -> Verify -> Map Pins / Hardware -> Export. Import is a utility action. Board programming is an external handoff after Export.

---

## Truth Hierarchy

When docs conflict, trust in this order:

| Priority | Source | What it covers |
|----------|--------|----------------|
| 1 | Code + tests | Runtime ground truth. Code wins over docs. |
| 2 | `AGENTS.md` + `AI_STATE.md` | Agent startup, latest repo posture, recent closed work. `AI_STATE.md` wins over prior prompt context. |
| 3 | `docs/ACTIVE_WORK.md` | Cockpit: current branch posture, blockers, latest proof, next target. |
| 4 | `docs/product/RED_BYTE_CURRENT_TRUTH.md` + `docs/product/RED_BYTE_WORK_QUEUE.md` | Compact current product truth and ordered work queue. |
| 5 | `docs/STUDENT_RELEASE_READINESS.md` | Certified starters, E0/E1/E2/E3 tier claims, TA-safe release posture. |
| 6 | `docs/manuals/RedByte_Product_Manual.md` + `docs/contracts/RedByte_Product_Contract.md` | Current behavior reference and target-state contract. |
| 7 | `docs/ide/0{N}-{surface}.md`, `docs/IDE_SYSTEM_MAP.md`, `docs/ide/SURFACE_CONFORMANCE.md` | Surface-level behavior and governance. |
| 8 | `docs/ARCHITECTURE.md` and `docs/DOC_INDEX.md` | Architecture and navigation for everything else. |
| Background only | `docs/00-canon/00-08-*.md`, `docs/STUDENT_WORKFLOW.md`, `docs/IMPLEMENTATION_STATUS.md` | OS-era, aspirational, or historical unless explicitly marked current. Current code/docs win. |

Canonical docs normally declare `doc_status: current` and `used_by_claude: true` in YAML frontmatter. Treat docs without those properties as background unless current docs point to them.

---

## Agent Startup

Before starting any task:

1. Start at the active clone root. The canonical desktop clone is `C:\Users\conno\redbyte-ui-genesis-main`. `C:\Users\conno\OneDrive\Documents\RedByte FPGA` is historical/local source context only unless the user explicitly selects it again.
2. Read `AGENTS.md`, then `AI_STATE.md`, then this file.
3. Read `docs/ACTIVE_WORK.md`, `docs/DOC_INDEX.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, and `docs/product/RED_BYTE_WORK_QUEUE.md`.
4. For product/surface work, read the relevant product manual, contract, surface specs, readiness docs, and proof docs named by `docs/DOC_INDEX.md`.
5. For recurring RedByte agent workflows, read the applicable repo-local playbook under `.agents/skills/*/SKILL.md`.
   - `redbyte-frontend-surface-builder`: frontend surface implementation, hierarchy, direct controls, and browser proof.
   - `redbyte-interaction-affordance-review`: live interaction audits for inert labels, rename/edit paths, weak affordances, and panel usability.
   - `redbyte-obsidian-brain`: Obsidian vault and ignored `.redbyte-brain/` working memory, with canonical docs still authoritative.
6. Run only the validation appropriate to the user-approved slice. For source or gate changes, use the relevant focused tests and `pnpm verify:gates`; for docs-only changes, prefer doc validation and encoding checks.

For strategic direction or multi-surface work, use the redbyte-prime agent in `.claude/agents/redbyte-prime.md` when that workflow is available.

---

## Runtime Constraints

### Windows and pnpm

Tests must be run from Windows. Some Vitest paths and scripts assume the Windows desktop clone.

Use the repo-pinned runtime when possible:

```powershell
node -v      # expected from .nvmrc: v20.19.0
corepack pnpm -v
```

The normal dev command should work after the user-level pnpm shim repair:

```powershell
pnpm run dev
```

If bare `pnpm` is not available on PATH, use:

```powershell
corepack pnpm <script-or-command>
```

Known caveat: `corepack enable` can fail without permission to write `C:\Program Files\nodejs\pnpm`. If a root script fails only because the shim is missing, reproduce with the direct `corepack pnpm ...` equivalent before treating it as a product failure.

### Test Runner

```powershell
corepack pnpm -w exec vitest run [pattern]
```

Current suite baseline and known failures live in `AI_STATE.md` and `docs/ACTIVE_WORK.md`. Do not treat a known baseline as a regression unless the failure count or shape changes.

### Connection Format

The canonical wire connection shape is:

```typescript
{ id: string, from: { nodeId: string, portName: string }, to: { nodeId: string, portName: string } }
```

The flat shape (`fromNodeId`, `toNodeId`, etc.) is never valid. `normalizePortRef` in `projectFormat.ts` will throw on it. All test fixtures must use the nested shape.

---

## Code Invariants

- TypeScript strict mode throughout. No `any` except legacy test fixtures with a comment.
- Prefer pure functions for logic that will be contract-tested.
- Determinism is non-negotiable: no wall-clock timestamps in hashes, no random IDs in verify/export paths.
- Port names must match Basys3 XDC exactly: `SW{N}`, `LD{N}`, `BTN{N}`, `CLK100MHZ`.

---

## Known Issues And Current Risks

- Two classroom golden export SHA gates are currently the first technical investigation target. Under the desktop audit runtime (Node 24.15.0, pnpm 10.24.0), `classroom-golden-basys3-export-gate.test.ts` and `classroom-golden-basys3-alu-export-gate.test.ts` failed with generated ZIP SHA drift. Do not update the committed golden SHAs until the drift is reproduced and explained under the repo-pinned Node 20.19.0 runtime.
- Vivado 2024.2 was not found at `C:\Xilinx\Vivado\2024.2\bin\vivado.bat` on this desktop during the audit. Do not claim fresh local E1/E2/E3 Vivado/Basys3 proof from this clone.
- Clean clones may not contain ignored/generated raw proof packs such as `.redbyte/bench/runs/**`, `out/vivado-cert/**`, `dist/**`, `test-results/**`, or `playwright-report/**`. Tracked proof docs remain the portable source of proof history.
- The older BUG-003 render-family baseline remains historical context in `AI_STATE.md`; verify the current failure shape before using it as active truth.

---

## Documentation Update Obligation

After any meaningful implementation batch:

1. Update `docs/ACTIVE_WORK.md` in-flight table and blockers.
2. Update the relevant surface spec in `docs/ide/` if behavior changed.
3. Update `docs/STUDENT_RELEASE_READINESS.md` if a certification tier changed.
4. Update `docs/product/RED_BYTE_CURRENT_TRUTH.md` or `docs/product/RED_BYTE_WORK_QUEUE.md` if the priority order changes.
5. Do not update OS-era docs as if they were current. Label historical notes as historical instead.

---

## Active Work

@docs/ACTIVE_WORK.md

---

## Obsidian Vault (Optional Context)

The Obsidian engineering brain lives in the repo-root vault folders (`00 Inbox/` through `10 Reference/`). It is useful working memory but is not mandatory startup reading unless the task needs it.

Key vault files if needed:

- `08 Agents + Prompts/Claude Session Mode.md`
- `08 Agents + Prompts/Canonical Notes Policy.md`
- `01 Dashboard/RedByte Engineering Brain.md`

Obsidian notes are working memory. Repo markdown files under `docs/` are canonical. When they conflict, current repo markdown wins.
