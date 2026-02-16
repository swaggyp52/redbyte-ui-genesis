# Lab Pack Template

A **Lab Pack** is the complete set of artifacts needed to run one lab in a classroom setting: a starter scaffold, integrity gates, smoke checks, and optional golden exports.

Lab 4 (ALU with Opcode Control) is the **canonical reference implementation**. Use it as a model for all new labs.

## Artifact matrix

| Artifact | Required | Path pattern | Lab 4 example |
| --- | --- | --- | --- |
| Starter scaffold JSON | Yes | `packages/rb-apps/src/examples/NN_labX-...-starter.json` | `19_lab4-alu-starter-basys3.json` |
| Lab definition entry | Yes | `packages/rb-apps/src/labs/labDefinitions.ts` | `id: 'lab-4'` entry |
| Example index entry | Yes | `packages/rb-apps/src/examples/index.ts` | `'19_lab4-alu-starter-basys3'` |
| No-solution gate | Yes | `packages/rb-apps/src/__tests__/ci-no-solution-labX-gate.test.ts` | `ci-no-solution-lab4-gate.test.ts` |
| Smoke script | Yes | `scripts/classroom-smoke-labX.ts` | `classroom-smoke-lab4.ts` |
| Rehearse script | Recommended | `scripts/classroom-rehearse-labX.ts` | `classroom-rehearse-lab4.ts` |
| Golden fixture (.rbproj) | Optional | `packages/rb-apps/src/fixtures/classroom/labX-*.rbproj` | `lab4-sanity-and.rbproj` |
| Golden export gate | Optional | `packages/rb-apps/src/__tests__/classroom-golden-*-export-gate.test.ts` | `classroom-golden-basys3-alu-export-gate.test.ts` |

## Naming conventions

- Starter JSON: `NN_labX-<descriptor>-starter[-board].json` (NN = sequence number)
- No-solution gate: `ci-no-solution-labX-gate.test.ts`
- Smoke script: `classroom-smoke-labX.ts`
- Rehearse script: `classroom-rehearse-labX.ts`
- Golden fixture: `labX-<descriptor>.rbproj`

## Scripts to add in root `package.json`

```json
"classroom:smoke:labX": "pnpm exec tsx ./scripts/classroom-smoke-labX.ts",
"classroom:rehearse:labX": "pnpm exec tsx ./scripts/classroom-rehearse-labX.ts",
"ci:no-solution:labX": "pnpm exec vitest run packages/rb-apps/src/__tests__/ci-no-solution-labX-gate.test.ts"
```

## Non-negotiables

### 1. Starter must be scaffold-only

- Contains I/O endpoint nodes with correct labels (switches, LEDs, etc.)
- Contains **zero connections** between functional blocks
- Contains at most 1 gate-type node (placeholder only, not wired)
- No suspicious names: `alu`, `solution`, `final`, `complete`

### 2. Determinism

- Any export (zip, rbproj) must produce identical SHA-256 across two consecutive runs
- Use `buildDeterministicZip` for all zip generation
- Use `stableStringify` for all JSON serialization in exports

### 3. Recovery UX

- Lab badge is visible in workspace header at all times
- If labId doesn't match a known definition, show mismatch warning with recovery steps
- Pre-submit preflight banner shows lab, board, mapping, and expected filename

### 4. No-solution gate heuristics

The gate must verify the starter does **not** contain:

- Connections between nodes (for combinational labs: `connections.length === 0`)
- More than 1 gate-type node (AND, OR, MUX, DECODER, etc.)
- Node labels matching solution patterns (lab-specific; e.g., `alu`, `opcode` for Lab 4)

The gate must verify the starter **does** contain:

- Minimum required I/O nodes with correct labels
- Lab definition entry with matching hardware steps / mapping terms

## Acceptance criteria (per lab)

- [ ] `pnpm -s classroom:smoke:labX` passes
- [ ] `pnpm -s ci:no-solution:labX` passes
- [ ] Starter loads in workspace and shows correct lab badge
- [ ] Export produces deterministic bundle
- [ ] No solution logic is present in the starter
- [ ] `pnpm -s verify:gates:classroom` still passes after adding the new lab

## Reference: Lab 4 file inventory

```
packages/rb-apps/src/examples/19_lab4-alu-starter-basys3.json
packages/rb-apps/src/__tests__/ci-no-solution-lab4-gate.test.ts
packages/rb-apps/src/fixtures/classroom/lab4-sanity-and.rbproj
packages/rb-apps/src/__tests__/classroom-golden-basys3-alu-export-gate.test.ts
scripts/classroom-smoke-lab4.ts
scripts/classroom-rehearse-lab4.ts
scripts/classroom-hw-check.ts
```
