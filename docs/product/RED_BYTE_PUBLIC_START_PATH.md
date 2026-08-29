---
doc_status: current
last_validated: 2026-08-28
owner: Connor Angiel
used_by_claude: true
role: public start path and local-run contract
---

# RedByte Public Start Path

## Purpose

The public start path gives a new technical user a truthful doorway into RedByte before they open the IDE.

It answers:

1. What RedByte is.
2. What workflow it supports.
3. How to open the IDE.
4. How to run the repo locally.
5. What Vivado/Basys3 handoff means.
6. What evidence is proven and what remains manual.

This is not a marketing site, a university pitch deck, or a claim that v1 is fully released.

## Route Contract

The public root redirects to:

```text
/start.html
```

The unified `dist/` artifact must include `start.html` at the root, and the root `index.html` fallback must also point to `/start.html` for static hosts that do not honor `_redirects`.

The IDE remains available at:

```text
/os/
```

`public/start.html` is a static, dependency-free page copied into the playground build output by Vite. It should stay small enough to load even when the IDE bundle is unavailable.

## Required Page Content

The page must preserve these public truths:

- RedByte is a proof-backed digital logic and FPGA workbench.
- The workflow spine is `Project -> Design -> Simulate -> Board & Constraints -> Build & Export`.
- Simulate is observe-first: a run records observed behavior even with zero checks; expected-output checks are optional and explicit.
- Vivado is downstream and is not replaced by RedByte.
- Trusted Export requires a current Simulate run with all checks passing and current mapping.
- Draft Export is allowed but must not be described as trusted.
- E0, E1, E2, and E3 remain separate.
- E2 board programming does not imply E3 observed behavior.
- Final E3 closure remains manual-observation gated for open rows.
- The repo uses pnpm; do not document `npm install`.

## Local Start Commands

For local IDE work:

```powershell
pnpm install
pnpm dev
```

For production-style local preview:

```powershell
pnpm --filter @redbyte/playground build
pnpm preview
```

## Vivado / Basys3 Boundary

The full hardware loop requires AMD Vivado 2024.2 and a physical Digilent Basys3 board.

RedByte may produce:

- E0 export packages.
- E1 Vivado build evidence when Vivado completes synthesis, implementation, and bitstream generation.
- E2 programming evidence when the bitstream programs a Basys3 target.

RedByte must not produce an E3 claim unless physical behavior is observed and recorded against the expected controls and outputs.

## Validation

Run:

```powershell
pnpm rb:site:start:test
pnpm rb:build:contract:test
pnpm build:unified
pnpm --filter @redbyte/playground build
```

The tests check that the page includes the product statement, workflow spine, E0/E1/E2/E3 language, local commands, and no forbidden E3/Vivado overclaims. The build contract test also checks that the deploy verifier accepts `/ -> /start.html`, rejects a stale `/ -> /os/` root redirect, and preserves `/os/` as the direct IDE entry.

## Update Rules

Update this doc and `public/start.html` when:

- The public route changes.
- Local start commands change.
- Vivado/Basys3 evidence posture changes.
- The release readiness checklist changes the website/start-path status.

Do not update the public page from generated packets or local memory artifacts alone. Repo current truth wins.
