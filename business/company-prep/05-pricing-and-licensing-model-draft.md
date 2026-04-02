# Pricing and Licensing Model — Draft

**Company:** RedByte LLC (proposed)
**Prepared:** 2026-04-02
**Status:** Draft for discussion. No final pricing numbers are set.

> This document proposes a business model that fits the founder's stated goals. Numbers marked as rough options should not be treated as commitments or market-validated figures.

---

## Guiding Principles

The business model should match the mission. RedByte exists because the founder wanted a tool that helps people learn digital logic — not to maximize revenue from a student population that can't afford it. That means:

- The free version must be genuinely useful, not crippled.
- Institutional licensing is the primary revenue path, not individual subscriptions.
- Pricing must be realistic for academic department budgets.
- Complexity should be minimal at launch — no ad-supported tiers, no paywalled core features.

---

## Proposed Three-Tier Structure

### Tier 1 — Free (Open Access)

**Who it's for:** Individual students, self-directed learners, makers, anyone curious.

**What it includes:**
- Full access to the circuit design environment
- Full simulation and verification workflow
- Hardware mapping surface
- Export of Vivado Kit ZIPs (VHDL, XDC, testbench, TCL)
- VHDL import
- All combinational and single-clock sequential circuit support
- Access to built-in starter examples and demos

**What it does not include (in the institutional tier):**
- Managed lab fixtures with instructor controls
- Bulk student submission + review tooling
- Institution-specific lab bundles
- Support SLA
- Priority feature requests

**Why free:** A meaningful free version is not charity — it is product distribution. Every student who uses RedByte independently and finds it useful is a potential advocate for institutional adoption. A free version that feels real and works well is the strongest possible sales tool.

---

### Tier 2 — Classroom / Lab License (Institutional)

**Who it's for:** Universities, colleges, ECE/CS departments, faculty, and training programs that want to formally integrate RedByte into their digital logic or computer architecture curriculum.

**What it includes (proposed — subject to product maturity):**
- Everything in the free tier
- Pre-built lab fixture library (lab 4 ALU starter, and others as they are developed)
- Instructor lab management tooling (assign labs, track student progress)
- Structured student submission archives with SHA-256 integrity hashes
- Instructor quickstart guides and TA spot-check materials (as they exist in the repo)
- Priority email support
- Use of RedByte branding in course materials

**Target buyers:** Department chairs, individual faculty, lab coordinators. Decision cycle is academic (fall/spring semester-driven). Pricing needs to fit within a course or department budget, not a capital expenditure approval process.

**Pricing shape options (rough, not validated):**

| Structure | Description | Rough Range |
|-----------|-------------|-------------|
| Per-seat annual | Per enrolled student per academic year | $10–$25/student/year |
| Lab license annual | Per lab section or course section | $200–$600/course/year |
| Department license | Unlimited students within a department | $1,000–$3,000/year |
| Pilot / trial | Free semester for first adopters, then convert | $0 for pilot |

**Recommendation:** Start with a department license or per-course model. Seat-counting is operationally messy for academic institutions and creates friction. A flat annual rate per department is simpler for both sides.

**Note:** These numbers are rough starting points for thinking. Real pricing requires understanding what similar educational tools (Logisim plugins, simulation licenses, lab software) cost in academic contexts, and what department chairs have budget authority to approve without going through full procurement. This is research that should happen before setting any pricing.

---

### Tier 3 — Pro (Individual, Future)

**Who it's for:** Serious individual learners — engineers refreshing hardware knowledge, makers building real designs, professionals exploring FPGA workflows — who want the full feature set without an institutional context.

**Status:** This tier is aspirational. It makes sense as a future offering but should not be the focus during early institutional adoption.

**Possible pricing shape:** $8–$15/month or $60–$100/year per individual.

**What might be in it:** Advanced lab content, extended sequential logic support as it ships, priority access to new features.

---

## Revenue Model Summary

The honest short-term revenue picture:

- **Free tier** drives distribution and credibility.
- **Classroom/Lab tier** is the primary revenue source. Target is academic institutions with existing Basys3 lab infrastructure.
- **Pro tier** is a future option, not a near-term priority.

The business does not depend on advertising. It is software licensing — specifically, educational software licensing to academic institutions. This is a known, understood market.

---

## Early Go-To-Market Approach

The most direct path to early institutional customers is through the founder's own academic network. Former professors, TAs, and department contacts are the warmest possible leads. The pitch is simple: this is a tool built by a student who took the course and felt the gap — here's what it does, here's how it fits into your existing Basys3 workflow, here's a free semester to try it.

That is not a cold sales pitch. That is a founder-led conversation with people who already understand the problem.

---

## What Needs to Be True Before Charging Institutions

RedByte is not yet ready for formal institutional licensing. The following must be in place first:

- The product is visually credible and polished enough that instructors would feel confident assigning it to students.
- Hardware rehearsal with real Basys3 boards has been validated.
- Student submission workflow is clean and instructor-verifiable.
- There is a support path for instructors when something breaks.
- The free version is clearly separated from the institutional version in terms of what the license allows.

None of these are impossible — some are already close. But honest self-assessment says the product is not yet in a place where you should be charging universities. That is not a problem; it is a roadmap.
