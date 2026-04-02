# Formation Readiness Checklist

**For:** Connor Angiel
**Prepared:** 2026-04-02

---

## Status Overview

RedByte is a real, working software product with a live deployment, a real domain, a proprietary license, and a clear commercial direction. The company has a strong story and a genuine founder motivation. The product is technically substantive.

That said, the product is still in active development and not yet fully ready for paid institutional deployments. This does not prevent forming the LLC — it just means the business will continue developing the product after formation.

Forming the LLC is the right move. The timing is "soon when you're ready" not "immediately today" and not "wait years."

---

## What Is Ready

- [x] The product exists and is live at [redbyteapps.dev](https://redbyteapps.dev)
- [x] The domain is registered and deployed
- [x] The codebase is authored and functional (six-surface workflow, deterministic simulation, verified export pipeline)
- [x] A proprietary license (RPL-1.0) is in place
- [x] The founder has a clear, honest, and compelling story for why the company exists
- [x] The business model makes sense (free + institutional licensing)
- [x] There is an existing instructor workflow (lab fixtures, submission archives, quickstart guides)
- [x] The architecture is sound and documented
- [x] The target user and market are well-defined
- [x] 220 automated tests green
- [x] A product manual and documentation system exist
- [x] The product has been used in a lab context (Lab 4 ALU fixture, instructor guides)
- [x] Vivado compatibility has been validated (6-case matrix in real Vivado)

---

## What Is Missing Before Formation

These are practical items you need to confirm before the attorney can file:

- [ ] Confirm "RedByte LLC" is available with the NY Department of State (check online)
- [ ] Decide what address (county) to use for the principal office
- [ ] Decide whether to use NY Secretary of State as registered agent or a commercial service
- [ ] Confirm your legal name for the Articles of Organization
- [ ] Understand the publication requirement cost for your county — Manhattan is expensive, other counties are much cheaper. This may influence which address you use.
- [ ] Have a conversation with an accountant about the tax treatment election before or at formation

---

## What Should Happen Before the LLC Is Operational for Business

After the LLC is formed, before the company starts entering into contracts or receiving money:

- [ ] File Articles of Organization with NY Department of State ($200 fee)
- [ ] Get EIN from IRS.gov (free, online, after state approval)
- [ ] Open a business bank account in the LLC's name — keep company money separate from personal money from day one
- [ ] Adopt a written Operating Agreement (required within 90 days in NY)
- [ ] Complete IP assignment: formally transfer the RedByte codebase and related assets from Connor personally to RedByte LLC (attorney prepares this)
- [ ] Complete the newspaper publication requirement and file Certificate of Publication ($50 fee + publication costs)
- [ ] Set up simple bookkeeping — even a spreadsheet is fine at first, but track every business expense separately
- [ ] Update the LICENSE file in the repo to list RedByte LLC as the copyright holder

---

## What Can Wait Until After Formation

These are things that matter eventually but do not need to happen before or immediately after filing:

- [ ] Trademark search and registration for "RedByte" — worth doing within the first year, not urgent on day one
- [ ] Full dependency license audit of the npm package tree — important before commercial licensing, not urgent during formation
- [ ] Domain transfer to LLC name — can be documented as an LLC asset first, transferred later
- [ ] Cloudflare account migration to LLC account — operational housekeeping, not formation-critical
- [ ] Website terms of service and privacy policy — needed before institutional licenses are signed
- [ ] Institutional sales conversations — product needs more polish first
- [ ] A third-party course materials review in the repo — confirm they are internal only, not in any public build artifact

---

## What Should Happen Before Paid Institutional Deployments

These are product milestones, not formation milestones, but they are prerequisites for actually charging schools:

- [ ] Visual polish passes a bar where instructors feel confident assigning the tool to students
- [ ] Hardware rehearsal with a real Basys3 board has been validated (GAP-013 in the audit)
- [ ] Student submission workflow is clean and instructor-verifiable in a real lab setting
- [ ] There is a documented support path for instructors
- [ ] The free vs. institutional tier distinction is clearly implemented (what is free, what requires a license)
- [ ] Terms of service and software license agreement appropriate for institutional use are drafted

---

## What You Need to Tell Your Parents' Friends

Keep it simple. Tell them:

> "I want to form RedByte LLC in New York. Single-member LLC, just me. It's a software company — I built an educational tool for digital logic and FPGA development that runs in the browser. It's live, it works, it has a proprietary license. I want to get the LLC set up so the business has its own legal identity and I can eventually license the software to schools. I just need basic formation — Articles of Organization, operating agreement, and making sure I handle the publication requirement correctly."

That is enough. They do not need to understand FPGA workflows. They need to understand: software company, single-member LLC, New York, straightforward formation.
