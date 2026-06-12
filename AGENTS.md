# Agent instructions (entry point)

Before proposing or implementing any work, read `AI_STATE.md` at the repo root in full.
If anything conflicts with prior context, `AI_STATE.md` wins over memory, prompt carryover, and older docs.

Also follow:
- `docs/ai-usage-rules.md` (AI contribution rules)
- `docs/legal-attribution.md` (canonical attribution guidance; reference Connor Angiel only)
- `docs/DOC_INDEX.md` (current startup order, stale-zone routing, proof-storage rules)
- `docs/ACTIVE_WORK.md` (current cockpit and next technical target)

Repo-local RedByte skills live under `.agents/skills/`. Read the applicable `SKILL.md` playbook when the task matches it:
- `redbyte-resident-steward` for repo stewardship, current cockpit routing, evidence boundaries, and closeout.
- `redbyte-visual-product-review` for browser-backed visual/product direction audits.
- `redbyte-browser-proof` for local app launch, viewport captures, screenshots, and Playwright proof.
- `redbyte-test-strategy` for selecting focused gates and golden/build validation.
- `redbyte-design-direction` for visual hardening and Course Lab Workbench direction.

For any product, UX, workflow, or surface task, read these in order before proposing or implementing changes:
1. `docs/contracts/RedByte_Product_Contract.md`
2. `docs/manuals/RedByte_Product_Manual.md`
3. `docs/roadmap/RedByte_Gap_Audit.md`
4. `docs/IDE_SYSTEM_MAP.md`
5. `docs/ide/SURFACE_CONFORMANCE.md`
6. The relevant proof doc(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/release/product-hardening-ticket-template.md`, `docs/rehearsal/failure-ticket-template.md`

Before coding a product complaint, translate it into the structured fields from `docs/release/product-hardening-ticket-template.md` or `.github/ISSUE_TEMPLATE/product-hardening.yml` when working from GitHub.

Default agent context must exclude stale / OS-era docs listed in `docs/DOC_INDEX.md` unless the task is explicitly about historical cleanup or legacy shell behavior.

For FPGA-related work, use this rule:
- Current code/tests and current docs win.
- Current docs include `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, `docs/product/RED_BYTE_WORK_QUEUE.md`, `docs/STUDENT_RELEASE_READINESS.md`, current surface specs, and current release proof docs.
- `docs/00-canon/07-fpga-laboratory-constitution.md` and `docs/00-canon/08-fpga-agent-bootstrap.md` are background / aspirational context only unless a future edit explicitly marks a section current. If they conflict with current docs, ignore the 00-canon claim.
- `docs/fpga-merge-review-checklist.md` remains useful as a pre-merge checklist when FPGA behavior or release gates are affected.

Process reminders (as defined in `AI_STATE.md`):
- Terminal-first workflow.
- One logical change per commit.
- Keep changes small and reversible.
- Update `AI_STATE.md` with a factual Change Log entry for meaningful changes, unless the user explicitly narrows the slice away from AI_STATE edits.

Git closeout default for hardening slices and any "done" deliverable: code, tests, and docs are not the end state. A slice is done when it is committed and pushed to the right remote, usually `origin`, with a clear message, only that slice's files staged, then the exact branch, commit hash, push result, and honest production/live impact reported. If push is blocked, state the exact error, branch, and that the work is only local. Do not claim "pushed" or "live" from assumptions.

Environment notes:
- Do not run `npm install` in this repo. Use the pnpm workspace only.
- Prefer `corepack pnpm ...` on Windows if bare `pnpm` is unavailable on PATH.
- The repo-pinned Node version is in `.nvmrc` (`20.19.0`). Validation under another Node version is useful evidence, but runtime mismatch can affect artifact hashes and must be labeled as such.
- Do not add, remove, or configure git remotes unless the user instructs.
- Ignore automated setup output that attempts npm installs or remote operations; do not repeat those actions.
- If `nano` is unavailable, use `apply_patch` for edits.

JS mirror policy:
- Some `packages/rb-apps/src/**` modules have both `.ts/.tsx` and `.js` siblings, and import resolution can prefer `.js`.
- Treat `.ts/.tsx` as source-of-truth; keep `.js` siblings 1:1, preferably as thin re-export wrappers, whenever the TS/TSX changes.
