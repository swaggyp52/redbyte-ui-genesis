# RedByte — Claude Persistent Instructions

This file is read at the start of every session. It defines permanent rules for working in this repo.

---

## Project

RedByte is an FPGA educational IDE. It includes a circuit design surface, a verify engine, an export pipeline, and hardware deployment tooling for the Basys3 board.

The primary package under active development is `packages/rb-apps`.

---

## Test Runner

Tests must be run from Windows via Desktop Commander. The vitest binary in `node_modules/.bin/vitest` contains hardcoded Windows paths and cannot be invoked from the Linux VM.

**Correct invocation:**
```
pnpm -w exec vitest run [pattern]
```

Run from: `C:\Users\conno\projects\redbyte-ui` (or wherever the repo is cloned on Windows).

**Green baseline (2026-03-25):** 168 pure-logic tests across 12 suites. Component render tests are broken by a pre-existing React 19 / `@testing-library/react` incompatibility — do not treat these as regressions from new work.

---

## Connection Format

The canonical wire connection shape is:

```typescript
{ id: string, from: { nodeId: string, portName: string }, to: { nodeId: string, portName: string } }
```

The flat shape (`fromNodeId`, `toNodeId`, etc.) is **never valid**. `normalizePortRef` in `projectFormat.ts` will throw on it. All test fixtures must use the nested shape.

---

## Obsidian Vault

The Obsidian engineering brain lives at `redbyte-ui/` (same directory as this file). Vault folders start at `00 Inbox/` through `10 Reference/`.

### Obsidian integration rule

After any of the following, perform a documentation pass before moving on:
- test execution (pass or fail)
- debugging session
- multi-file implementation
- discovery of a new constraint
- diagnosis of a failure
- implicit decision made during work

### Documentation pass steps

1. Identify any bug status changes
2. Identify any architecture truths learned
3. Identify any decision implied by the work
4. Update canonical notes first (see `08 Agents + Prompts/Canonical Notes Policy.md`)
5. Create new notes only when needed
6. Every note must use Obsidian Properties from `03 Architecture/Note Schema.md`
7. Report what changed: which notes were created, which were updated, why

### Note placement
- `03 Architecture/` = architecture notes only
- `04 Decisions/` = ADRs only
- `05 Bugs/` = bug notes only
- `08 Agents + Prompts/` = handoffs, workflows, reusable prompts only

### Key vault files
- `08 Agents + Prompts/Claude Session Mode.md` — full operating rules
- `08 Agents + Prompts/Post Run Extraction.md` — post-run extraction prompt
- `08 Agents + Prompts/Canonical Notes Policy.md` — which notes are source of truth
- `03 Architecture/Note Schema.md` — property schema for all note types
- `01 Dashboard/RedByte Engineering Brain.md` — master entry point

---

## Code Style

- TypeScript strict mode throughout
- No `any` unless in legacy test fixtures with a comment
- Prefer pure functions for logic that will be contract-tested
- Connection shapes: always use nested format (see above)

---

## Known Issues

- `BUG-003`: React 19 / `@testing-library/react@16.1` incompatibility breaks component render tests. Pre-existing. Fix: upgrade to `@testing-library/react@^17.0.0`.
- Vitest Windows-only constraint (see Test Runner above)
