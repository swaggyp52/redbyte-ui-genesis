---
doc_status: current
last_validated: 2026-07-27
owner: Connor Angiel
used_by_claude: true
role: Stable Preview - Browser-E0 closeout and recovery record
---

# RedByte Stable Preview Closeout

## Identity

- Date: 2026-07-27
- Post-repair product baseline SHA: `66f901ff13b6ddd0a0a73a4328a95c4df5274886`
- Preserved v2B candidate SHA: `a5b67274f3c43820e89d538cbf2171256fef3759`
- Canonical branch after publication: `main`
- Stable tag: `redbyte-stable-preview-2026-07-27`
- Release posture: **Stable Preview - Browser-E0**

The exact published main SHA is the commit targeted by
`redbyte-stable-preview-2026-07-27`. Resolve it without relying on prose:

```powershell
git rev-list -n 1 redbyte-stable-preview-2026-07-27
git rev-parse main
git rev-parse origin/main
```

Those three values must agree. A commit cannot embed its own final object ID in
its tracked contents, so the signed repository reference is the authoritative
exact-main record.

## Supported Workflows

The current student flow is:

```text
Project
-> Design Edit / Live
-> Verify Scenario / Replay / Optional Checks
-> Map Pins
-> Export
```

The stable preview supports:

- blank and starter combinational authoring, including the Full Adder loop;
- exploratory Live propagation without manufacturing Verify evidence;
- zero-check simulation, optional expected-output checks, mismatch repair, and
  read-only circuit/waveform Replay;
- Register1 with one clock, rising-edge capture, active-high asynchronous reset,
  supported enable semantics, manual clock/reset scenarios, and sequential Replay;
- canonical Basys3 resource/package-pin mapping;
- inspection and download of Browser-E0 VHDL, XDC, testbench, Tcl, metadata, and
  recovery artifacts;
- reviewed Import with cancel-safe preservation of the active project.

## Validated Scope

Local validation uses Node 20.19.0 and pnpm 10.24.0. The closeout covers focused
v2A/v2B runtime tests, typecheck, IDE CSS audit, unified build, documentation and
encoding checks, diff hygiene, a current-build SHA check, and bounded Chromium
smokes at `1366x768` and `1440x900`.

## Known Limitations

- RegisterBus, StateBank, falling-edge capture, multi-clock designs, active-low
  reset, and unsupported Register1 modes are blocked.
- Browser-local scenario policy is not a new portable `RBProject` field.
- The stable preview is not a universal HDL IDE, Vivado replacement, automatic
  bitstream service, LMS, grading service, or proof of classroom reliability.

## Start

```powershell
cd C:\Users\conno\redbyte-ui-genesis-main
git switch main
git pull --ff-only
corepack pnpm run dev
```

Open `http://localhost:5173`. The top bar exposes the current build SHA in its
build identity.

## Backup and Recovery

The pre-consolidation safety archive is:

```text
C:\Users\conno\RedByteArchive\2026-07-27\
```

It contains the verified all-refs bundle
`redbyte-pre-consolidation.bundle`, ignored product-immersion evidence, manual
artifacts, and a branch/tag/worktree inventory. The preservation tag is
`redbyte-stable-preview-preconsolidation-2026-07-27`.

Inspect a recovery bundle before use:

```powershell
git bundle verify C:\Users\conno\RedByteArchive\2026-07-27\redbyte-pre-consolidation.bundle
git bundle list-heads C:\Users\conno\RedByteArchive\2026-07-27\redbyte-pre-consolidation.bundle
```

## Vivado and Hardware Boundary

Browser-E0 means RedByte browser behavior and generated-package structure were
validated locally. This closeout did not run Vivado, generate a bitstream,
program a Basys3, or observe physical board behavior. E1, E2, and E3 remain
separate future proof activities.

## Deferred Work

1. Vivado E1 proof for a named stable-preview export.
2. Basys3 E2 programming and separate E3 observation.
3. A supervised classroom pilot with measured recovery and TA support.
4. RegisterBus/StateBank runtime-to-VHDL parity.
5. Larger-design and mapping-depth work driven by stable-preview evidence.
