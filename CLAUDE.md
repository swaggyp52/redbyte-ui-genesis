# RedByte — Agent Operating Manual

RedByte is an **FPGA educational IDE**. Project is the dashboard/home surface; students then design circuits, verify behavior against test vectors, bind ports to Basys3 resources in Map Pins / Hardware, and export Vivado-ready packages. Primary package: `packages/rb-apps`. Target hardware: Basys3 (`xc7a35tcpg236-1`). Vivado 2024.2.

The canonical product hierarchy is: **Project -> Design -> Verify -> Map Pins / Hardware -> Export.** Import is a utility action. Board programming is an external handoff after Export.

---

## Truth Hierarchy

When docs conflict, trust in this order:

| Priority | Source | What it covers |
|----------|--------|---------------|
| 1 | Code + tests | Ground truth — code wins over all docs |
| 2 | `docs/ACTIVE_WORK.md` | **Cockpit** — top 3 priorities, blocked, latest proof, next bench task |
| 3 | `docs/STUDENT_RELEASE_READINESS.md` | Certified starters, E1/E2/E3 tiers |
| 4 | `docs/ide/0{N}-{surface}.md` | Surface-level specs |
| 5 | `docs/ARCHITECTURE.md` | Five-layer architecture |
| 6 | `docs/DOC_INDEX.md` | Navigation for everything else |
| IGNORE | `docs/00-canon/00–08-*.md` | OS-era (3D Redstone, CPU OS, bridge endpoints). Not current. |
| IGNORE | `docs/STUDENT_WORKFLOW.md`, `IMPLEMENTATION_STATUS.md` | OS-era. Not current. |

**Trust signal:** Canonical docs declare `doc_status: current` and `used_by_claude: true` in YAML frontmatter. Treat any doc without these properties as background context, not authoritative truth.

---

## Agent Startup

Before starting any task:

1. Read `docs/ACTIVE_WORK.md` — know what's in flight and what the priority ladder is.
2. Run `pnpm verify:gates` if gates may be affected — never commit a batch that breaks a green gate.
3. Check `docs/DOC_INDEX.md` if you need a surface spec, release proof, or roadmap doc.

For strategic direction or multi-surface work, use the **redbyte-prime** agent in `.claude/agents/redbyte-prime.md`.

---

## Runtime Constraints

### Test Runner (Windows-only)

Tests must be run from Windows via Desktop Commander. The vitest binary has hardcoded Windows paths and cannot run from a Linux VM.

```
pnpm -w exec vitest run [pattern]
```

Run from: `C:\Users\conno\redbyte-ui`

**Current suite baseline:** use `AI_STATE.md` as the live source for focused/full-suite counts and known pre-existing failures. Do not treat the known BUG-003 render-family baseline as a regression unless the failure count or shape changes.

### Connection Format

The canonical wire connection shape is:

```typescript
{ id: string, from: { nodeId: string, portName: string }, to: { nodeId: string, portName: string } }
```

The flat shape (`fromNodeId`, `toNodeId`, etc.) is **never valid**. `normalizePortRef` in `projectFormat.ts` will throw on it. All test fixtures must use the nested shape.

---

## Code Invariants

- TypeScript strict mode throughout. No `any` except legacy test fixtures with a comment.
- Prefer pure functions for logic that will be contract-tested.
- Determinism is non-negotiable: no wall-clock timestamps in hashes, no random IDs in verify/export paths.
- Port names must match Basys3 XDC exactly: `SW{N}`, `LD{N}`, `BTN{N}`, `CLK100MHZ`.

---

## Known Issues

- **BUG-003 family**: the full IDE suite still carries pre-existing React 19 / testing-library render-family failures. Installed `@testing-library/react` is `16.3.2`; do not assume a simple version bump is the fix.
- Vitest Windows-only constraint (see Runtime Constraints above).

---

## Documentation Update Obligation

After any meaningful implementation batch (new feature, bug fix, surface change, release proof):

1. Update `docs/ACTIVE_WORK.md` in-flight table and blockers.
2. Update the relevant surface spec in `docs/ide/` if behavior changed.
3. Update `docs/STUDENT_RELEASE_READINESS.md` if a certification tier changed.
4. Do **not** update OS-era docs — they are superseded and should remain labeled as such.

---

## Active Work

@docs/ACTIVE_WORK.md

---

## Obsidian Vault (Optional Context)

The Obsidian engineering brain lives at `redbyte-ui/` (vault folders `00 Inbox/` through `10 Reference/`). It is useful working memory but is **not mandatory agent startup reading**. Key vault files if you need them:

- `08 Agents + Prompts/Claude Session Mode.md` — session operating rules
- `08 Agents + Prompts/Canonical Notes Policy.md` — which vault notes are source of truth
- `01 Dashboard/RedByte Engineering Brain.md` — master entry point

Obsidian notes are working memory. Repo markdown files (`docs/`) are canonical. When they conflict, repo markdown wins.
