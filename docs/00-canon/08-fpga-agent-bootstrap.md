# 08 — FPGA Agent Bootstrap (Quick Reference)

**Status:** CANONICAL  
**Last Updated:** 2026-01-05  
**Maintainer:** Connor Angiel

**Read this before proposing or implementing FPGA-related work.**

---

## The One-Liner

RedByte OS is a **production-grade, deterministic FPGA laboratory platform** that replaces traditional lab tooling. It operates on **real hardware**, enforces **determinism**, and prioritizes **truth over convenience**.

---

## Three-Layer Architecture (Never Mix Responsibilities)

1. **Toolchain** (`rb-fpga-toolchain`) — Build-time only. Wraps HDL, generates artifacts. Never touches hardware.
2. **Bridge** (`rb-fpga-bridge`) — Runtime only. Talks to hardware, streams data. Never builds HDL.
3. **Board Models** (`board-models/*`) — Immutable truth. Pinmaps, clocks, protocols.

---

## Four Non-Negotiable Invariants

1. **Determinism Over Convenience** — No wall-clock timestamps. No unordered data. No platform-dependent output.
2. **Explicit Contracts** — Enforce interfaces. Define protocols. Use stable error codes.
3. **Hardware Is Truth** — Mock only for CI. Surface failures. Never fake data.
4. **Additive Evolution** — Add fields. Don't repurpose. Version explicitly.

---

## What This Means for Agents

### ✅ You MAY:

* Deploy sub-agents with narrow scope
* Add tests and validation
* Propose minimal, reversible changes
* Request clarification when uncertain

### ❌ You MAY NOT:

* Mix toolchain and bridge responsibilities
* Violate determinism for convenience
* Mask hardware failures
* Break existing endpoints or protocols
* Invent new architectures casually

---

## Current State (Ground Truth)

**Bridge**: `/devices`, `/program`, `/run`, `/stream`, `/stop` — all working. Honest "running_no_data" behavior.

**Toolchain**: Deterministic wrapper generation. Pinmap hash gating. CI-safe tests.

**Validation**: Smoke tests exist. Hardware validation pending.

---

## When in Doubt

**Ask yourself:**

1. Does this preserve determinism?
2. Does this respect the three-layer split?
3. Does this surface failures honestly?
4. Does this break existing contracts?

If any answer is "no," **stop and request clarification**.

---

## Full Context

For complete details, read [07-fpga-laboratory-constitution.md](./07-fpga-laboratory-constitution.md).

---

**Remember:** RedByte is allowed to be strict. It is **not allowed to be wrong**.