---
applyTo: "packages/rb-apps/src/apps/ide/**/*.ts,packages/rb-apps/src/apps/ide/**/*.tsx,packages/rb-apps/src/apps/ide/__tests__/**/*.ts,packages/rb-apps/src/apps/ide/__tests__/**/*.tsx"
---

# RedByte — IDE Surface Rules

## Product spine

The canonical workflow is:

```
Project → Design → Verify → Map Pins / Hardware → Export
```

- Import is a utility entry point, not a workflow step.
- Board programming is an external handoff after Export.
- Do not reorder, collapse, or rename steps without explicit scope.

## Trust language invariants

- **NEEDS REVIEW** chip must always name a specific fix path — never use generic copy like "Check settings."
- Distinguish **Draft Export** (artifact-ready, no Verify evidence) from **Trusted Export** (current Compare PASS + current mapping + current bundle).
- Distinguish **mapped hardware** (physical pin assignment exists) from **verified trust** (Verify Compare evidence exists).
- `failureTruth.condition` drives condition-specific hint text — do not collapse conditions into generic messages.

## Code rules

- TypeScript strict mode throughout — no `any` except legacy test fixtures with explicit comment.
- Immutable state patterns throughout React components — create new objects, never mutate in place.
- Connection shape: `{ id, from: { nodeId, portName }, to: { nodeId, portName } }` — flat shape is never valid.
- Port names must match Basys3 XDC exactly: `SW{N}`, `LD{N}`, `BTN{N}`, `CLK100MHZ`.
- Do not bypass `projectWorkflowAuthority` or product health state logic.

## Test rules

- Write tests before behaviour/copy changes (TDD).
- Tests asserting a UI element is visible must use fixture states where that element should render.
- Tests asserting a UI element is hidden must use fixture states where that element should not render.
- Do not assert presence of elements that conditional logic hides in the tested state.
- Run `pnpm -w exec vitest run [pattern]` from `C:\Users\conno\redbyte-ui` (Windows only).

## Change discipline

- Avoid broad surface rewrites. One logical change per commit.
- Stage only the active slice's files.
- Run gates and build before committing.
- Do not push unless explicitly instructed.
