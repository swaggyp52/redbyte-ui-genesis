# Product Tier Policy

**Company:** RedByte LLC (proposed)
**Prepared:** 2026-04-02
**Purpose:** Define exact product boundaries between tiers. This is an internal policy document, not marketing copy. It answers: what does each tier include, what does it exclude, and what has to be built before each tier is real?

---

## The Line

**Free is for learning. Paid is for deploying as a course.**

A student using RedByte to build circuits, understand hardware, and complete their own work — never needs to pay. The full learning workflow is free.

A department or instructor deploying RedByte as the platform for a class — managing lab assignments, reviewing submissions, running structured lab sections — is deploying it as course infrastructure. That is what the institutional license covers.

Everything below flows from this distinction.

---

## Tier 1: Free

### Who this is for
Any individual — student, learner, maker, professional, or curious person — accessing RedByte at [redbyteapps.dev](https://redbyteapps.dev).

### What is included — currently shipped

| Feature | Status |
|---------|--------|
| Full circuit design environment (schematic editor, all logic primitives) | Shipped |
| Deterministic tick-based simulation | Shipped |
| Verification engine (pass/fail, waveform viewer, diagnostic hints) | Shipped |
| Design-time structural error detection (loops, multiple drivers, floating outputs) | Shipped |
| Hardware surface — Basys3 pin mapping (all 4 modes) | Shipped |
| Export surface — Vivado Kit ZIP (VHDL, XDC, testbench, TCL) | Shipped |
| Import surface — VHDL import with fidelity reporting | Shipped |
| Built-in starter examples and demo circuits | Shipped |
| Project surface — name, metadata, readiness tracker | Shipped |
| No account required | Shipped |
| No installation required | Shipped |

### What is explicitly not included in the Free tier

These features are either not built yet or are reserved for the institutional tier:

| Feature | Reason excluded |
|---------|-----------------|
| Managed lab fixtures with instructor-side controls | Institutional feature — requires product build work |
| Student submission review tooling for instructors | Institutional feature — requires product build work |
| Institution-specific lab bundles / curriculum packages | Institutional feature |
| Support SLA (guaranteed response time) | Reserved for paying customers |
| Priority feature development input | Reserved for paying customers |

### What is free but has institutional analogs

The submission archive export (SHA-256 integrity hashes, ZIP download) exists in the free product and works for individual use. The institutional version adds review-side tooling — the ability for instructors to import, review, and grade submissions at scale. The submission itself is free; the instructor-side workflow is institutional.

---

## Tier 2: Classroom / Lab License (Institutional)

### Who this is for
Universities, colleges, ECE/CS departments, individual faculty members, and training programs that are formally deploying RedByte as part of a digital logic or computer architecture curriculum.

### What is included — currently shipped

These institutional features already exist in the product today:

| Feature | Status | Notes |
|---------|--------|-------|
| Everything in the Free tier | Shipped | |
| Lab 4 ALU starter fixture | Shipped | `19_lab4-alu-starter-basys3.json` |
| Classroom rehearsal scripts | Shipped | `pnpm classroom:rehearse:lab4` |
| Instructor quickstart guide | Shipped | `CLASSROOM_QUICKSTART_INSTRUCTOR.md` |
| Student quickstart guide | Shipped | `CLASSROOM_QUICKSTART_STUDENT.md` |
| Student submission archives with SHA-256 hashes | Shipped | Export ZIP includes integrity verification |
| TA spot-check vectors | Shipped | Defined per lab fixture |
| Gate-level readiness verification | Shipped | `pnpm verify:gates` |

### What needs to be built before institutional licensing begins

These are the features that differentiate the institutional tier in a way that justifies a contract — and they are not yet shipped:

| Feature | Status | Priority |
|---------|--------|----------|
| Instructor submission review interface | Not yet built | High — required before charging |
| Expanded lab fixture library (beyond Lab 4 ALU) | In progress | High — one lab fixture is thin |
| Live Basys3 hardware rehearsal proven | Open (GAP-013) | High — required before hardware-integrated courses |
| Visual polish passes instructor confidence bar | In assessment | High — product must look professional enough to assign to students |
| Documented support path for instructors | Not yet defined | Required before institutional contracts |

### What a paying institution is contracting for

Until the "needs to be built" list above is complete, the honest answer is: **we are not ready to sign institutional contracts**. The product needs to be at a bar where a professor can confidently assign it to a class of 30 students and trust that it works.

When that bar is met, a paying institution should be contracting for:

- The full institutional feature set (lab management, submission review, lab library)
- A software license agreement specifying the terms of use, user limits, and restrictions
- A support arrangement (email, defined response time)
- Access to new lab fixtures and curriculum materials as they are developed
- The right to use RedByte branding in course syllabi and materials

---

## Tier 3: Pro (Individual, Future)

### Who this is for
Serious individual learners outside of an institutional context — engineers refreshing hardware knowledge, makers who want the full FPGA workflow, professionals who want lab-grade features without an institutional license.

### Status
**This tier does not exist yet and is not near-term priority.** It is defined here so the product architecture accounts for it and future decisions are made with it in mind.

### What it would include
Everything in the Free tier, plus:

- Access to the full institutional lab fixture library (the same content available in Classroom tier)
- Extended sequential logic support as it ships (falling-edge, multi-clock, etc.)
- Priority access to new features
- A license agreement that explicitly permits commercial and professional use beyond the learning context

### What makes this tier distinct from Classroom

The Classroom tier is built around multi-user deployment — managing students, reviewing submissions, running lab sections. The Pro tier is a single individual who wants the full feature set without the institutional infrastructure. They are buying the content and the extended feature set, not the instructor tooling.

---

## Before Tier 2 Is a Real, Chargeable Product

Tier 2 does not exist yet in a form you can charge for. The product is close on several items but "close" is not "ready to charge a university." Here is the specific gap, in priority order:

| Item | Status |
|------|--------|
| Visual polish — product looks professional enough to assign to students | In assessment (Phase 7 in Gap Audit) |
| Expanded lab fixture library (3–5 labs minimum) | Lab fixtures exist beyond Lab 4, but library needs curation |
| Instructor submission review interface | Not yet built |
| Live Basys3 hardware rehearsal validated | Open (GAP-013) |
| Support path — email address, defined response time | Not yet defined |
| Attorney-drafted institutional software license agreement | Not yet drafted |

None are unreachable. The product is legitimately close on several. This table is the honest checklist for when Tier 2 becomes sellable.
