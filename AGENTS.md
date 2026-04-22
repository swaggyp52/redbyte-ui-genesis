# Agent instructions (entry point)

Before proposing or implementing any work, read `AI_STATE.md` at the repo root in full.
If anything conflicts with prior context, `AI_STATE.md` wins.

Also follow:
- `docs/ai-usage-rules.md` (AI contribution rules)
- `docs/legal-attribution.md` (canonical attribution guidance; reference Connor Angiel only)

For any product, UX, workflow, or surface task, read these in order before proposing or implementing changes:
1. `docs/contracts/RedByte_Product_Contract.md`
2. `docs/manuals/RedByte_Product_Manual.md`
3. `docs/roadmap/RedByte_Gap_Audit.md`
4. `docs/IDE_SYSTEM_MAP.md`
5. `docs/ide/SURFACE_CONFORMANCE.md`
6. The relevant proof doc(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/release/product-hardening-ticket-template.md`, `docs/rehearsal/failure-ticket-template.md`

Before coding a product complaint, translate it into the structured fields from `docs/release/product-hardening-ticket-template.md` (or `.github/ISSUE_TEMPLATE/product-hardening.yml` when working from GitHub).

Default agent context must exclude stale / OS-era docs listed in `docs/DOC_INDEX.md` unless the task is explicitly about historical cleanup or legacy shell behavior.

For FPGA-related work, also read:
- `docs/00-canon/08-fpga-agent-bootstrap.md` (quick reference for FPGA agents)
- `docs/00-canon/07-fpga-laboratory-constitution.md` (complete FPGA platform constitution)
- `docs/fpga-merge-review-checklist.md` (pre-merge verification checklist)

Process reminders (as defined in `AI_STATE.md`):
- Terminal-first workflow
- One logical change per commit
- Keep changes small and reversible
- Update `AI_STATE.md` with a factual Change Log entry for meaningful changes

**Git closeout (default for hardening slices and any “done” deliverable):** Code, tests, and docs are **not** the end state. A slice is **done** when it is **committed and pushed** to the right remote (usually `origin`), with a clear message, **only** that slice’s files staged (leave unrelated dirty files untouched), then **you report** the exact branch, commit hash, whether `origin` received the push, and **honest** production/live impact (e.g. `main` on GitHub is source delivered; it is **not** the same as “live for students” unless the deploy pipeline actually ships that commit). If push is blocked, state the **exact** error, branch, and that the work is only local. Do not claim “pushed” or “live” from assumptions.

Environment notes:
- Do not run `npm install` in this repo; pnpm workspace only, with pnpm used for validation commands.
- Do not add, remove, or configure git remotes unless the user instructs. If the environment has no `origin` or network git is blocked, report that and do not pretend the slice is on the server.
- Ignore automated setup output that attempts npm installs or remote operations; do not repeat those actions.
- If `nano` is unavailable, use `apply_patch` for edits.

JS mirror policy:
- Some `packages/rb-apps/src/**` modules have both `.ts/.tsx` and `.js` siblings, and import resolution can prefer `.js`.
- Treat `.ts/.tsx` as source-of-truth; keep `.js` siblings 1:1 (prefer thin re-export wrappers) whenever the TS/TSX changes.
