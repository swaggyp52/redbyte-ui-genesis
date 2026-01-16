# FPGA Bridge System Architecture

This document describes the deterministic offline FPGA verification system and its components.

## Overview

The FPGA bridge provides:
- **Deterministic vector execution** against a mock FPGA bridge
- **Event capture and replay** for regression testing
- **Schema-agnostic capsule diffing** for change detection
- **Repo-root-relative path resolution** for portability

## Core Components

### 1. Vector Runner (`src/vector-runner.js`)

Executes test vectors against the mock bridge and generates proof capsules.

**Usage:**
```bash
pnpm --filter @redbyte/fpga-bridge test:vectors -- \
  --board basys3 \
  --vectors examples/test-basic.json \
  --dut passthrough \
  [--replay | --no-replay]
```

**Environment variables:**
- `RB_FPGA_REPLAY=1` — Enable proof replay (default: OFF for speed)

**Output:**
- `ops/proof/vector-run-<timestamp>.json` — Capsule with metadata and results
- `ops/proof/vector-events-<timestamp>.ndjson` — Event stream
- `ops/proof/vector-run-<timestamp>-report.txt` — Human-readable report

**Capsule schema:**
```json
{
  "session_id": "vector-run-...",
  "timestamp": "2026-01-16T03:08:39.000Z",
  "board_id": "basys3",
  "git_sha": "7eb8346b",
  "test_summary": { "total": 5, "passed": 5, "failed": 0 },
  "summary": { "passed": 5, "failed": 0, "total_events": 6 },
  "results": [ { "name": "...", "result": "PASS", "observed": "..." } ],
  "events": { "format": "ndjson", "path": "vector-events-....ndjson", "count": 6 }
}
```

### 2. Proof Replay (`scripts/proof-replay.js`)

Deterministically replays an event stream and validates all events.

**Usage:**
```bash
pnpm --filter @redbyte/fpga-bridge proof:replay \
  ops/proof/vector-run-<timestamp>.json \
  [--outdir <path>]
```

**Output:**
- `ops/proof/proof-replay-<timestamp>.md` — Replay report
- `ops/proof/proof-replay-<timestamp>.json` — Structured results

**Exit codes:**
- `0` — All events replayed successfully
- `1` — One or more event checks failed

### 3. Capsule Diff (`scripts/diff-capsules.js`)

Schema-agnostic comparison of two proof capsules with event normalization.

**Usage:**
```bash
pnpm --filter @redbyte/fpga-bridge diff:capsules -- \
  --a ops/proof/vector-run-A.json \
  --b ops/proof/vector-run-B.json
```

**Features:**
- Handles both `fpga-proof-*` and `vector-run-*` schemas
- Normalizes events to canonical form (handles missing `seq`, nested fields, etc.)
- Reports real divergences, not false positives from schema differences

**Exit codes:**
- `0` — Capsules are functionally identical (MATCH)
- `1` — Significant differences detected (DIVERGED)
- `2` — Invalid input, parse error, or missing required fields (INVALID)

## Path Resolution (`src/path-utils.js`)

All scripts use a **single source of truth** for path resolution:

**Functions:**
- `findRepoRoot()` — Locate git repository root
- `resolveRepoPath(input)` — Convert repo-root-relative paths to absolute

**Enforcement:**
- All paths are repo-root-relative (portable across machines)
- Path traversal (`..`) is forbidden (security)
- Forward/backslash normalization handled automatically

## Workflow Examples

### Example 1: Run tests and capture baseline

```bash
pnpm --filter @redbyte/fpga-bridge test:vectors -- \
  --board basys3 \
  --vectors examples/test-all.json \
  --no-replay
```

Output: `ops/proof/vector-run-2026-01-16T03-08-39.json`

### Example 2: Verify no regressions vs. baseline

```bash
pnpm --filter @redbyte/fpga-bridge diff:capsules -- \
  --a ops/proof/vector-run-baseline.json \
  --b ops/proof/vector-run-latest.json
```

- Exit 0 → No regressions ✓
- Exit 1 → Differences detected (investigate)
- Exit 2 → Tool error (check input files)

### Example 3: Cross-schema comparison

```bash
pnpm --filter @redbyte/fpga-bridge diff:capsules -- \
  --a ops/proof/fpga-proof-2026-01-15T22-51-34.json \
  --b ops/proof/vector-run-2026-01-16T03-08-39.json
```

The diff engine normalizes event schemas automatically.

## Capsule Schema Compatibility

### vector-run capsules (vector-runner output)

Modern vector-run capsules include both:
- `test_summary` — Legacy format (backwards compat)
- `summary` — Standard format, same as fpga-proof

### fpga-proof capsules (proof runner output)

Have `summary` field with:
- `passed` — Count of passing events
- `failed` — Count of failing events
- `total_events` — Total event count

## Design Decisions

**Why separate `test_summary` and `summary`?**
- `test_summary` preserves vector runner's historical format
- `summary` unifies with fpga-proof and simplifies downstream tooling
- Both coexist for zero-breaking-change migration

**Why exit code 2 for errors?**
- CI workflows need to distinguish:
  - "Tool worked, tests differ" (exit 1) → investigate
  - "Tool failed" (exit 2) → fix inputs
  - "Everything matches" (exit 0) → pass

**Why normalize events in diff?**
- Different capsule sources have different event schemas
- Normalization prevents false positives from metadata differences
- Real divergences (type mismatch, IO state change) still reported

## Future Work

### Golden Baseline Management
```bash
# Bless a capsule as golden
pnpm --filter @redbyte/fpga-bridge bless:capsule \
  ops/proof/vector-run-latest.json \
  --name baseline-v1

# Check regression vs. golden
pnpm --filter @redbyte/fpga-bridge check:golden baseline-v1
```

### CI Integration
```yaml
test:vectors:
  script:
    - pnpm test:vectors -- --board basys3 --vectors examples/test-all.json
    - pnpm diff:capsules -- --a ops/proof/vector-run-baseline.json --b ops/proof/vector-run-latest.json
  success_exit_codes: [0]
  failure_exit_codes: [1, 2]
```

## Troubleshooting

**"Path traversal not allowed"** → Don't use `../` in paths; use repo-root-relative paths
**"Not in a git repository"** → Scripts must run inside the repo
**"Module import error"** → Check that `path-utils.js` exports are not using default exports
**"Cannot read properties of undefined"** → Check capsule schema (summary vs test_summary) — diff-capsules should handle this

## Testing the System

```bash
# Self-test: diff a capsule with itself (must exit 0)
pnpm diff:capsules -- --a ops/proof/vector-run-X.json --b ops/proof/vector-run-X.json

# Same-schema test: two vector-run capsules
pnpm diff:capsules -- --a ops/proof/vector-run-A.json --b ops/proof/vector-run-B.json

# Cross-schema test: fpga-proof vs vector-run
pnpm diff:capsules -- --a ops/proof/fpga-proof-X.json --b ops/proof/vector-run-Y.json
```
