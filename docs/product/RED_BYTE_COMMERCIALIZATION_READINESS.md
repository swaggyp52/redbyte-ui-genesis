---
doc_status: current
last_validated: 2026-06-14
owner: Connor Angiel
used_by_claude: true
role: RedByte commercialization and deployment readiness assessment
---

# RedByte Commercialization Readiness

Date: 2026-06-14
Source audit: `docs/audits/2026-06-12-redbyte-whole-app-product-immersion-audit.md`

## Verdict

RedByte is technically credible but not yet commercially ready as an unsupervised classroom-critical product.

The right near-term path is:

1. Free public hosted app for evaluation and student use.
2. Instructor/campus support package after UX hardening and rehearsal proof.
3. Downloadable or campus-hosted package for institutions that need local control.
4. Accounts/SaaS only after there is a concrete user-data, grading, collaboration, or classroom-management requirement.

Do not market it as a Vivado replacement. RedByte is a learning IDE and proof-handoff tool. Vivado remains downstream for synthesis, implementation, bitstream generation, and board programming.

## What Is Commercially Promising

- The product has a narrow, understandable promise: visual digital logic, Verify checks, Basys3 mapping, and Vivado-ready E0 export packages.
- The core workflow spine is real: Project -> Design -> Verify -> Map Pins / Hardware -> Export.
- Certified starter flows pass in browser automation.
- Blank-canvas AND workflow can reach Verify PASS and Export.
- E0 package content is structurally credible and explicitly avoids overclaiming hardware proof.
- Import/export recovery and project persistence have automated coverage.
- Evidence-tier language gives RedByte a trustworthy basis for instructor conversations.

## What Blocks Paid Classroom Use Today

| Blocker | Why it matters commercially | Required resolution |
|---|---|---|
| First-viewport UX hierarchy | Students and instructors need confidence without guided explanation. | Project, Design, Hardware, and Export first viewports must show the object/action students need. |
| Verify failure-repair risk | Debugging is the learning loop. A stuck repair path becomes support debt. | Focused regression and fix for expected-output edit -> fail -> repair -> pass. |
| Export action/state ambiguity | Export is the handoff to Vivado; contradictory state hurts trust. | One visible trust state and one primary next action. |
| No fresh local Vivado/Basys3 proof | Hardware claims are the riskiest public promise. | Run E1/E2/E3 proof on a Vivado 2024.2 + Basys3 machine before claiming hardware readiness. |
| Support packaging still incomplete | Paid users buy reliability, docs, and response paths as much as software. | Student, instructor, TA, and Windows quickstarts now exist under `docs/course/`; still need fresh Vivado/Basys3 proof, support response boundaries, license/privacy review, and deployment posture before paid classroom use. |
| License/privacy/compliance posture not finalized | Institutions need clear terms and data boundaries. | Decide free/public, support license, local package, and privacy posture before selling. |

## Deployment Options

### Option A: Free public hosted app

Use when:

- The goal is adoption, demos, student access, and proof gathering.
- No accounts or stored student data are required.

Pros:

- Lowest operational burden.
- Easy for instructors to trial.
- Matches current local-first app shape.

Risks:

- Needs clear browser/device support statement.
- Needs deploy proof before calling it live.
- Needs careful E0/E1/E2/E3 language on public pages.

Readiness: recommended after first-viewport UX hardening and deployment smoke proof.

### Option B: Instructor/campus support package

Use when:

- Institutions want help adopting RedByte in labs.
- Value is support, curriculum fit, installation guidance, and proof process.

Pros:

- Monetizes expertise without premature account infrastructure.
- Fits RedByte's hardware-adjacent classroom use.
- Can coexist with a free hosted app.

Risks:

- Requires support SLAs or at least clear response boundaries.
- Requires strong quickstarts and known-limitations docs.

Readiness: recommended commercialization model after classroom rehearsal proof.

### Option C: Downloadable or campus-hosted package

Use when:

- A school needs local network control or offline access.
- Privacy or IT policy blocks public hosted tools.

Pros:

- Good fit for a browser/static app if deployment packaging is stable.
- Avoids central student data handling.

Risks:

- Version drift and support overhead.
- Needs install/update docs and environment diagnostics.

Readiness: viable after build/deploy package proof and support docs.

### Option D: Accounts/SaaS

Use when:

- There is a specific requirement for saved student projects across devices, grading workflows, class rosters, collaboration, analytics, or LMS integration.

Pros:

- Could support classroom management later.

Risks:

- Adds privacy, security, uptime, billing, support, account recovery, and data-retention obligations.
- Solves no current core product problem visible in this audit.

Readiness: defer.

## Minimum Readiness Bar Before Charging

Product:

- Project first launch shows the recommended path without scrolling.
- Starter Design first viewport shows the actual circuit.
- Verify failure-repair loop is regression-tested.
- Map Pins first viewport shows board/table/current mapping.
- Export first viewport shows one trust state and one primary action.
- Import recovery remains safe and review-gated.

Proof:

- Product-immersion browser suite passes.
- Import/export recovery passes.
- Vivado artifact inspection passes.
- Blank-canvas product proof passes without local ad hoc workarounds, or the workaround is documented as an environment issue.
- Fresh Vivado/Basys3 E1/E2/E3 proof exists for any paid hardware-readiness claim.

Docs:

- Instructor quickstart: `docs/course/INSTRUCTOR_QUICKSTART.md`.
- Student first-lab quickstart: `docs/course/STUDENT_QUICKSTART.md`.
- TA troubleshooting guide: `docs/course/TA_TROUBLESHOOTING_GUIDE.md`.
- Windows setup quickstart: `docs/course/windows-quickstart.md`.
- Known-good starter list.
- Known limitations and external proof tiers.
- Vivado handoff troubleshooting.
- Support ticket template and response boundaries.

Operational:

- Deployment target and update process defined.
- Browser support statement defined.
- License terms reviewed.
- Privacy/data statement reviewed.
- Clear distinction between "source pushed to GitHub" and "live for students".

## Suggested Offer Positioning

Near-term:

RedByte is a browser-based FPGA learning IDE for Basys3 labs. Students can design logic, verify behavior, map board IO, and export a Vivado-ready package. Vivado and the board remain the downstream hardware proof path.

Do not promise:

- Vivado replacement.
- Automatic bitstream generation in browser.
- Hardware behavior proof without a board run.
- Production-grade classroom management.
- Full HDL IDE parity.

Possible paid offer after readiness bar:

- Campus support and adoption package for instructors using RedByte in Basys3-based digital logic courses.
- Includes onboarding, lab fit review, deployment guidance, troubleshooting support, and evidence/proof templates.

## Commercialization Sequence

1. Finish first-viewport product hardening.
2. Fix Verify failure-repair risk.
3. Package current student/instructor/TA quickstarts.
4. Run two clean classroom rehearsal passes.
5. Restore fresh Vivado/Basys3 proof on hardware.
6. Publish a free hosted evaluation build with honest E0/E1/E2/E3 language.
7. Pilot with one trusted course or instructor.
8. Only then define pricing and support terms.

## Current Readiness Summary

| Area | Status | Notes |
|---|---|---|
| Core product concept | Strong | Narrow and differentiated. |
| Student workflow spine | Stronger | Browser gates cover current Project, Design, Verify, Hardware, Export, Import, and quickstart docs now explain the path. |
| Verification trust | Stronger | Compare/failure explanation and edit-repair path are gate-backed. |
| Export package | Strong E0 | Artifact inspection passes; no local Vivado run. |
| Hardware proof | Not current on this desktop | Vivado absent locally. |
| Import/recovery | Stronger but utility-scoped | Representative manifest/corrupt recovery is browser-gated; broad arbitrary HDL migration remains outside current claims. |
| Deployment | Not assessed as live | Local servers only in this audit. |
| Support/docs | Improved but still partial | Current student, instructor, TA, and Windows quickstarts exist under `docs/course/`; support process, license/privacy, deployment, and hardware proof remain open. |
| SaaS readiness | Not justified | Defer accounts and hosted data. |

