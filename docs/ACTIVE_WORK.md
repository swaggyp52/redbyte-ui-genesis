---
doc_status: current
last_validated: 2026-07-27
owner: Connor Angiel
used_by_claude: true
imported_by: CLAUDE.md
---

# RedByte - Active Work Cockpit

## Canonical Source

- Canonical clone: `C:\Users\conno\redbyte-ui-genesis-main`
- Canonical operating branch after closeout: `main`
- Remote: `https://github.com/swaggyp52/redbyte-ui-genesis.git`
- Preserved v2B candidate: `a5b67274f3c43820e89d538cbf2171256fef3759`
- Integrated product baseline: `66f901ff13b6ddd0a0a73a4328a95c4df5274886`
- Target board: Basys3 (`xc7a35tcpg236-1`)
- Pinned runtime: Node 20.19.0 / pnpm 10.24.0

The current stage is **Stable Preview - Browser-E0**. Historical RC, product,
rescue, and checkpoint branches are recovery evidence, not active development
sources. Do not start v2C from this cockpit.

## Product Truth

The RedByte-owned student flow is:

```text
Project
-> Design Edit / Live
-> Verify Scenario / Replay / Optional Checks
-> Map Pins
-> Export
```

Import / Recover is a separate reviewed utility. Vivado build, bitstream
generation, Basys3 programming, and physical observation are downstream proof
tiers outside the browser.

### Combinational

- Build Fresh produces a deterministic blank project.
- Design Edit owns structure; Live owns exploratory propagation; Replay is
  read-only evidence from a Verify run.
- Full Adder authoring, zero-check simulation, optional checks, mismatch
  diagnosis/repair, mapping, and generated-file inspection are supported.

### Sequential

- Supported: Register1, one clock, rising-edge capture, active-high
  asynchronous reset, and supported enable semantics.
- Supported workflow: manual clock/reset scenario, waveform/circuit Replay,
  canonical Basys3 mapping, and Browser-E0 testbench inspection.
- Blocked: RegisterBus, StateBank, falling-edge capture, multi-clock designs,
  active-low reset, and unsupported register modes.

### Evidence

- Simulation records observed behavior even with zero checks.
- Expected-output checks are optional.
- A zero-check run may be Simulated but never trusted/validated.
- Current passing checks are required for trusted Export authority.
- Semantic design or scenario changes stale prior proof; layout-only movement
  does not.

## Current Closeout Work

1. Finish bounded Node 20 tests, typecheck, CSS audit, unified build, docs, and
   encoding validation.
2. Prove current root `corepack pnpm run dev` and the two exact classroom
   viewports in a fresh browser context.
3. Fast-forward `main`, push the stable-preview tag, close superseded PR #79,
   and observe the existing deployment pipeline.
4. Remove only clean merged worktrees/branches after archive and reachability
   proof.

## Start

```powershell
cd C:\Users\conno\redbyte-ui-genesis-main
git switch main
git pull --ff-only
corepack pnpm run dev
```

Open `http://localhost:5173`.

## Proof Boundary

Stable Preview - Browser-E0 is not a production-readiness, Vivado, bitstream,
hardware, classroom-certification, or maintenance-free claim. The verified
pre-consolidation archive is under
`C:\Users\conno\RedByteArchive\2026-07-27\`.
