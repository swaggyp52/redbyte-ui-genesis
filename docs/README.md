# RedByte Documentation OS

**Welcome to the complete documentation system for RedByte.**

This is not a typical `/docs` folder with scattered markdown files. This is a **Documentation OS** — a structured knowledge system that proves complete understanding of the codebase, captures all design decisions, and enables anyone to rebuild the system from scratch.

---

## What Is RedByte?

**RedByte** is a deterministic interactive computation framework for teaching digital logic and computer architecture from first principles to CPU design.

- **One computational truth, many views**: Circuit, schematic, 3D Redstone, timing diagram, HDL
- **Local-first**: Runs entirely in browser, no server, no account, no telemetry
- **Deterministic**: Same inputs → same outputs, every time. Reproducible, trustworthy.
- **Keyboard-first**: Power users can build circuits without touching mouse
- **Never lie to teach**: Real propagation delay, real timing, no oversimplifications

🎯 **Goal**: A motivated 15-year-old can build a working CPU from scratch using only RedByte.

---

## Documentation Structure

### `/00-canon/` — Canonical Truth

The **source of truth** documents. If it's in `/00-canon/`, it's authoritative.

| Document | Purpose | Audience |
|----------|---------|----------|
| [00 — Project Identity](./00-canon/00-project-identity.md) | What RedByte is/isn't, who it's for, design philosophy | Everyone |
| [01 — Core Principles](./00-canon/01-core-principles.md) | 8 principles that guide every decision | Developers, auditors |
| [02 — Determinism Contract](./00-canon/02-determinism-contract.md) | Exact semantics, guarantees, verification | Technical auditors |
| [03 — System Architecture](./00-canon/03-system-architecture.md) | Packages, boundaries, data flow | Developers, architects |
| [04 — Experience Design](./00-canon/04-experience-design.md) | Learn Mode, Build Mode, UI philosophy | Product, UX |
| [05 — Roadmap](./00-canon/05-roadmap.md) | Near-term vs long-term, explicitly labeled | Stakeholders, contributors |
| [06 — Owner's Manual](./00-canon/06-owners-manual.md) | **"I can rebuild this from scratch"** proof document | Interview, audit, future self |

**Start here:** Read [00 — Project Identity](./00-canon/00-project-identity.md) first.

### `/01-dev/` — Developer Mastery

**For contributors** who want to understand the system and ship code.

| Document | Purpose | Status |
|----------|---------|--------|
| [dev-setup.md](./01-dev/dev-setup.md) | Install, build, test, dev, preview, deploy | 📝 TODO |
| [repo-tour.md](./01-dev/repo-tour.md) | Monorepo walkthrough, package purposes | 📝 TODO |
| [coding-standards.md](./01-dev/coding-standards.md) | Patterns: Zustand, controlled components, invariants | 📝 TODO |
| [debugging-playbook.md](./01-dev/debugging-playbook.md) | How to diagnose issues, where state lives | ✅ See [Owner's Manual](./00-canon/06-owners-manual.md#q-what-happens-if-this-breaks-where-do-i-look-first) |
| [tests-and-quality.md](./01-dev/tests-and-quality.md) | What tests exist, how to add per PR | 📝 TODO |
| [release-process.md](./01-dev/release-process.md) | Stop-point criteria, smoke tests, tagging | ✅ See [release-stop-point.md](./release-stop-point.md) |

### `/02-systems/` — Subsystem Deep Dives

**Proof of mastery.** Each document explains one subsystem in complete detail: purpose, invariants, data structures, files, critical flows, failure modes.

| Subsystem | File | Status |
|-----------|------|--------|
| Circuit Model | [circuit-model.md](./02-systems/circuit-model.md) | 📝 TODO |
| Simulation Engine | [simulation-engine.md](./02-systems/simulation-engine.md) | 📝 TODO |
| Zustand Store & Mutation Pipeline | [zustand-store-and-mutation-pipeline.md](./02-systems/zustand-store-and-mutation-pipeline.md) | ✅ See [Owner's Manual](./00-canon/06-owners-manual.md) + [TRACEABILITY.md](./TRACEABILITY.md) |
| Undo/Redo | [undo-redo.md](./02-systems/undo-redo.md) | ✅ See [Owner's Manual](./00-canon/06-owners-manual.md#q-how-does-undoredo-work) |
| Wiring & Validation | [wiring-and-validation.md](./02-systems/wiring-and-validation.md) | ✅ See [TRACEABILITY.md](./TRACEABILITY.md#wiring--validation) |
| Multi-View Sync | [multi-view-sync.md](./02-systems/multi-view-sync.md) | ✅ See [Owner's Manual](./00-canon/06-owners-manual.md#q-how-does-multi-view-sync-work) |
| Learn Mode | [learn-mode.md](./02-systems/learn-mode.md) | ✅ See [TRACEABILITY.md](./TRACEABILITY.md#learn-mode) |
| Circuit Health | [circuit-health.md](./02-systems/circuit-health.md) | ✅ See [TRACEABILITY.md](./TRACEABILITY.md#circuit-health) |
| Chip System | [chip-system.md](./02-systems/chip-system.md) | ✅ See [CHIP_SYSTEM_SUMMARY.md](./CHIP_SYSTEM_SUMMARY.md) |
| Determinism Tools | [determinism-tools.md](./02-systems/determinism-tools.md) | ✅ See [TRACEABILITY.md](./TRACEABILITY.md#determinism-tools-recordreplay) |
| Export (Future) | [export-future.md](./02-systems/export-future.md) | 📝 PLANNED |

### `/03-product/` — Product & UX

**For product thinking** and user experience design.

| Document | Purpose | Status |
|----------|---------|--------|
| [user-workflows.md](./03-product/user-workflows.md) | Build, debug, learn flows | 📝 TODO |
| [onboarding-and-ux.md](./03-product/onboarding-and-ux.md) | First-run experience, tooltips | ✅ See [ONBOARDING_PLAN.md](./ONBOARDING_PLAN.md) |
| [public-demo-mode.md](./03-product/public-demo-mode.md) | Demo constraints, public site behavior | 📝 TODO |

### `/04-company/` — Business & Organization

**For stakeholders** who need to understand the business context.

| Document | Purpose | Status |
|----------|---------|--------|
| [company-why.md](./04-company/company-why.md) | Life's work framing, mission | 📝 TODO |
| [llc-and-ops.md](./04-company/llc-and-ops.md) | LLC, banking, accounting, IP stance | 📝 TODO |
| [fundraising-qa.md](./04-company/fundraising-qa.md) | Investor questions, grounded answers | 📝 TODO |
| [positioning.md](./04-company/positioning.md) | Education + professional tool strategy | 📝 TODO |

### `/05-archive/` — Historical Documents

**Preserved for context**, not actively maintained. These show how decisions were made and why.

- [SESSION_SUMMARY.md](./05-archive/session-logs/SESSION_SUMMARY.md) — Development session logs
- [STAGE0_COMPLETE.md](./05-archive/session-logs/STAGE0_COMPLETE.md) — Milestone report
- [/pdf-versions/](./05-archive/pdf-versions/) — Historical versions of specs

### `/99-placeholders/` — Future Documentation

**Clearly marked "PLANNED"** — not yet implemented.

| Document | Trigger | Owner |
|----------|---------|-------|
| verilog-export.md | When HDL export ships | Connor |
| collaboration-system.md | When multi-user features ship | Connor |
| cloud-sync.md | When optional cloud features ship | Connor |
| integrity-layer.md | When cryptographic verification ships | Connor |

---

## Special Documents

### [TRACEABILITY.md](./TRACEABILITY.md) — Documentation → Code Maps

**The proof document.** Links every concept to actual code locations.

- Subsystems → Files
- Critical flows → Step-by-step code paths
- Concepts → Implementation details
- Tests → Coverage maps

**Use this to verify documentation claims against actual code.**

### [ARCHITECTURE.md](./ARCHITECTURE.md) — System Architecture

High-level technical architecture: kernel layer, desktop shell, app layer, data flow.

**Legacy status:** Will be superseded by `/00-canon/03-system-architecture.md` (TODO).

### [release-stop-point.md](./release-stop-point.md) — Stabilization Release

Definition of Done for stabilization sprint. Manual QA checklist, production readiness criteria.

**Current release status:** ✅ COMPLETE (2026-01-05)

---

## How to Use This Documentation

### I'm a New User

1. Read: [00 — Project Identity](./00-canon/00-project-identity.md) — What is RedByte?
2. Try: Build a simple circuit (AND gate + switches + lamp)
3. Explore: Learn Mode tutorials (in-app, press `/` for help)

### I'm a New Developer

1. **Day 1:**
   - Read: [00 — Project Identity](./00-canon/00-project-identity.md)
   - Read: [01 — Core Principles](./00-canon/01-core-principles.md)
   - Setup: [dev-setup.md](./01-dev/dev-setup.md) (TODO) — For now: `pnpm install && pnpm run dev`

2. **Week 1:**
   - Read: [06 — Owner's Manual](./00-canon/06-owners-manual.md) — Complete system walkthrough
   - Explore: [TRACEABILITY.md](./TRACEABILITY.md) — Map concepts to code
   - Fix: Pick a small bug from GitHub Issues

3. **Month 1:**
   - Read: All of `/02-systems/` — Deep dive each subsystem
   - Ship: Implement a small feature (new gate type, UI improvement)

### I'm an Investor / Auditor

1. Read: [00 — Project Identity](./00-canon/00-project-identity.md) — What problem does this solve?
2. Read: [06 — Owner's Manual](./00-canon/06-owners-manual.md) — Can the founder rebuild this?
3. Review: [TRACEABILITY.md](./TRACEABILITY.md) — Verify claims match code
4. Ask: Questions in `/04-company/fundraising-qa.md` (TODO)

### I'm the Future Connor (1 Year From Now)

1. Read: [06 — Owner's Manual](./00-canon/06-owners-manual.md) — Remember how this works
2. Review: [05-archive/](./05-archive/) — Why did I make those decisions?
3. Check: [TRACEABILITY.md](./TRACEABILITY.md) — Has code drifted from docs?
4. Update: All canonical docs if anything has changed

---

## Documentation Principles

This documentation system follows strict rules:

### 1. **Grounded in Reality**
Never document features that don't exist. If it's documented, it's implemented (or clearly marked "PLANNED").

### 2. **Auditability**
Every claim links to code. Use [TRACEABILITY.md](./TRACEABILITY.md) to verify.

### 3. **Durable Tone**
No hype, no marketing, no superlatives. Just facts, code locations, and reasoning.

### 4. **Explicit Uncertainty**
Mark TODOs, PLANNEDs, and unknowns clearly. Never pretend to know more than we do.

### 5. **Traceability**
Maps from concepts → files → functions. If you can't trace it, it's not documented.

### 6. **Historical Context**
Archive old docs, don't delete. Show why decisions were made.

---

## Status Labels

Every document uses one of these labels:

- **CANONICAL**: Source of truth, actively maintained
- **CURRENT**: Accurate as of last edit, may need updates
- **PLANNED**: Design document, not yet implemented
- **ARCHIVED**: Historical record, no longer current
- **STUB**: Placeholder needing expansion
- **TODO**: Not yet written

---

## Contributing to Documentation

### When to Update Docs

Update documentation when:

1. **Shipping a feature**: Add subsystem doc to `/02-systems/` if new subsystem
2. **Fixing a bug**: Update [Owner's Manual](./00-canon/06-owners-manual.md) debugging section if bug was tricky
3. **Changing architecture**: Update `/00-canon/03-system-architecture.md` (TODO)
4. **Breaking principles**: Update `/00-canon/01-core-principles.md` (requires justification)

### Doc Review Checklist

Before merging a PR that changes docs:

- [ ] Updated [TRACEABILITY.md](./TRACEABILITY.md) if code locations changed
- [ ] Updated [Owner's Manual](./00-canon/06-owners-manual.md) if core flows changed
- [ ] Marked "Last Updated" date in document header
- [ ] Verified no broken internal links
- [ ] Added entry to document changelog section

---

## Quick Links

### Most Important Docs

1. [00 — Project Identity](./00-canon/00-project-identity.md) — Start here
2. [06 — Owner's Manual](./00-canon/06-owners-manual.md) — Complete system understanding
3. [TRACEABILITY.md](./TRACEABILITY.md) — Proof of understanding

### Current Status

- **Release:** ✅ Stabilization complete (2026-01-05)
- **Tests:** ✅ 36/36 core tests passing
- **Build:** ✅ Production build succeeds
- **Docs:** 🚧 Documentation OS in progress (canonical docs complete, dev docs TODO)

### External Resources

- **GitHub**: [swaggyp52/redbyte-ui-genesis](https://github.com/swaggyp52/redbyte-ui-genesis)
- **Product Spec** (PDF): [RedByte OS & Logic Playground – Product and Systems Specification.pdf](../RedByte%20OS%20%26%20Logic%20Playground%20%E2%80%93%20Product%20and%20Systems%20Specification.pdf)
- **License**: RedByte Proprietary License (RPL-1.0) — See [LICENSE](../LICENSE)

---

## Documentation Health

**Last Full Audit:** 2026-01-05

| Section | Status | Completeness |
|---------|--------|--------------|
| `/00-canon/` | ✅ Core docs written | 60% (3/6 files complete) |
| `/01-dev/` | ⚠️ Mostly TODO | 20% (info in Owner's Manual) |
| `/02-systems/` | ✅ Mapped in TRACEABILITY | 80% (content exists, needs extraction) |
| `/03-product/` | ⚠️ Mostly TODO | 30% (some existing docs) |
| `/04-company/` | ❌ All TODO | 0% |
| `/05-archive/` | ⚠️ Needs organization | 50% (files exist, not organized) |
| TRACEABILITY | ✅ Complete | 100% |

**Overall Documentation OS Progress: 45%**

---

## Changelog

- **2026-01-05**: Documentation OS initialized
  - Created canonical docs (00, 01, 06)
  - Created TRACEABILITY.md
  - Organized existing docs
  - Defined structure for remaining docs

---

**This is a living documentation system. As RedByte evolves, these docs evolve. Keep them synchronized with code, or they become lies.**
