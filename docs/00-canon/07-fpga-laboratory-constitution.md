# 07 — FPGA Laboratory Platform Constitution

**Status:** CANONICAL  
**Last Updated:** 2026-01-05  
**Maintainer:** Connor Angiel

---

## 0. Executive Summary (Read This First)

RedByte OS is a **production-grade, deterministic FPGA laboratory platform** designed to **replace traditional digital logic lab tooling** (Vivado GUIs, ISE GUIs, oscilloscopes, ad-hoc screenshots, and manual grading workflows).

It is **not a simulator**, **not a toy**, and **not a convenience wrapper** around vendor tools.

RedByte exists to answer one question:

> *How do we make real FPGA hardware observable, reproducible, verifiable, and gradeable at classroom scale—without lying, hand-waving, or relying on fragile GUIs?*

Everything in this system flows from that constraint.

---

## 1. What RedByte **IS**

### 1.1 A Real Hardware System

RedByte operates on **real FPGA boards**, currently:

* Basys 3 (Artix-7, Vivado)
* Spartan-3E Starter Kit (ISE, stubbed/manual for now)

No simulation is allowed to pretend to be hardware.
If hardware is not producing data, the system must say **"running_no_data"**, not fabricate samples.

---

### 1.2 A Deterministic Laboratory Environment

Determinism is non-negotiable.

Given:

* the same student HDL
* the same board model
* the same wrapper generator
* the same pinmap

RedByte must produce:

* byte-identical build artifacts
* stable hashes
* reproducible behavior
* verifiable evidence

This applies even when **hardware is absent** (CI, offline validation).

---

### 1.3 A Split-Brain Architecture (by design)

RedByte is intentionally divided into **three major layers**:

#### A. Toolchain (Build-Time)

`rb-fpga-toolchain`

* Deterministically wraps student HDL
* Injects UART protocol + observability
* Enforces strict interface contracts
* Generates manifests, pinmap hashes, build logs
* Optionally invokes vendor tools (Vivado / ISE)
* Can run fully offline (`--skip-vivado`, `--skip-ise`)

This layer **never talks to hardware directly**.

---

#### B. Bridge (Runtime / Hardware I/O)

`rb-fpga-bridge`

* Discovers connected hardware
* Merges UART + JTAG identities
* Programs FPGA bitstreams
* Streams live samples over SSE
* Emits diagnostics, logs, and status
* Never lies if data is missing

This layer **never builds HDL**.

---

#### C. Board Models (Canonical Truth)

`board-models/*`

* Define pinmaps (XDC / UCF)
* Define clock frequencies
* Define UART pins
* Define hash gates

Board models are **immutable contracts**, not suggestions.

---

### 1.4 A Protocol-Driven System

RedByte uses a **binary framing protocol (RBHB)** over UART, carrying **JSON payloads**.

Key design rule:

> The **wrapper owns the protocol**, not the student design.

Student HDL is *pure logic*.
The wrapper injects:

* IDENTIFY
* STREAM_START / STOP
* SAMPLE frames
* Timestamping

---

### 1.5 A Truthful UX

RedByte prioritizes **truth over smoothness**.

* "running_no_data" is a valid state
* Missing timestamps are a hard failure
* Pinmap mismatches fail early
* Every failure must produce an **actionable error code**

---

## 2. What RedByte **IS NOT**

RedByte is **not**:

* ❌ A simulator pretending to be hardware
* ❌ A GUI replacement for Vivado/ISE
* ❌ A cloud FPGA service
* ❌ A teaching toy
* ❌ A monolithic application
* ❌ A best-effort system

If something cannot be verified, RedByte must not claim it.

---

## 3. Core Invariants (Never Violate These)

Any agent that violates these is **wrong by definition**.

### 3.1 Determinism Over Convenience

* No timestamps based on wall clock unless explicitly allowed
* No unordered JSON
* No platform-dependent output
* No hidden randomness

---

### 3.2 Explicit Contracts Over Implicit Behavior

* Student top interface is enforced
* Protocol fields are defined
* Error codes are stable tokens
* Schemas exist for everything that matters

---

### 3.3 Hardware Is the Source of Truth

* Mock paths exist only for CI
* Hardware failures are surfaced, not masked
* No fake samples, ever

---

### 3.4 Additive Evolution Only

* Do not break existing bridge endpoints
* Do not silently change protocol semantics
* Add fields, do not repurpose them
* Gate new behavior behind explicit versions

---

## 4. Current System State (Ground Truth)

### 4.1 Bridge

* `/devices` — deterministic discovery + confidence scoring
* `/program` — JTAG programming via `djtgcfg`
* `/run`, `/stream` (SSE), `/stop` — live streaming
* `/log`, `/logs` — safe diagnostics
* IDENTIFY + SAMPLE parsing
* Robust timestamp parsing (numeric / hex string)
* Honest "running_no_data" behavior

---

### 4.2 Toolchain

* Deterministic wrapper generation
* Strict student interface enforcement
* Pinmap hash gating
* `lab.json` defaults
* Basys 3 Vivado automation (optional)
* Spartan-3E stub generator (`--skip-ise`)
* CI-safe, hardware-free tests

---

### 4.3 Smoke & Validation

* HDL smoke fixtures exist
* `smoke.ps1` provides one-command checkout
* Smoke fails hard on missing timestamps
* Hardware validation pending (expected)

---

## 5. What RedByte **NEEDS TO BECOME**

This is the forward vision.

### 5.1 Course-Scale Orchestration

RedByte needs a **lab runner layer** that:

* builds
* programs
* runs
* streams
* collects evidence
* fails cleanly

This must be scriptable, dependency-free, and deterministic.

---

### 5.2 Evidence as a First-Class Artifact

Every lab run must be able to produce an **Evidence Capsule**:

* design hashes
* pinmap hash
* wrapper hash
* sample excerpts
* summary statistics
* integrity hash

This is how grading scales.

---

### 5.3 Protocol Constitution

The RBHB protocol must be **explicitly documented**, versioned, and locked by tests.
This prevents drift between wrapper and bridge.

---

### 5.4 Long-Run Stability

Labs last hours.
The bridge must:

* bound memory
* handle garbage frames
* survive disconnects
* shut down cleanly

---

## 6. How This Project Must Be Developed

### 6.1 Multi-Agent Development Rules

Agents may be deployed **only** if:

* their scope is narrow
* they do not overlap files unnecessarily
* they produce tests
* they respect invariants

Agents must:

* explain reasoning
* cite files
* propose minimal changes
* add acceptance criteria

---

### 6.2 What an Overarching Agent Is Allowed to Do

A planning/orchestration agent may:

* deploy sub-agents
* assign tickets
* merge work cautiously
* block unsafe changes
* request clarification

It may **not**:

* invent new architectures casually
* bypass determinism gates
* relax contracts for speed
* declare success without evidence

---

## 7. Canonical Next Phases (High-Level)

These are *safe*, non-speculative directions:

1. **Protocol Constitution + Golden Fixtures**
2. **Streaming Soak & Stability Hardening**
3. **Lab Manifest & Bundling**
4. **Evidence Capsule Generation**
5. **One-Command Lab Runner**
6. **Hardware Validation (when available)**

Anything beyond this requires explicit justification.

---

## 8. Final Directive to the Overarching Agent

You are not here to "make progress quickly."
You are here to **make RedByte trustworthy**.

If forced to choose:

* Choose correctness over features
* Choose determinism over convenience
* Choose explicit failure over silent success

RedByte is allowed to be strict.
It is **not allowed to be wrong**.

---

**End of Document.**

---

## Related Documents

* [RB_FPGA_MVP_SPEC.md](../RB_FPGA_MVP_SPEC.md) — Detailed implementation contract
* [00-project-identity.md](./00-project-identity.md) — General RedByte OS identity
* [01-core-principles.md](./01-core-principles.md) — Core design principles