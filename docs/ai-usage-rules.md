# AI usage rules (repo-local)

## Authority
- `AI_STATE.md` at the repo root is authoritative. If anything conflicts, `AI_STATE.md` wins.

## Architectural invariants
- IDE-first product truth is canonical: default `/` boots the six-surface IDE, while `/?launcher=1` is an explicit legacy/dev shell path and not the default product narrative.
- Monorepo structure is permanent; packages remain modular and independent
- Terminal-first development only
- `main` is production (Cloudflare Pages auto-deploy)

For product, UX, workflow, or surface work, the minimum read order after `AI_STATE.md` is:
1. `docs/contracts/RedByte_Product_Contract.md`
2. `docs/manuals/RedByte_Product_Manual.md`
3. `docs/roadmap/RedByte_Gap_Audit.md`
4. `docs/IDE_SYSTEM_MAP.md`
5. `docs/ide/SURFACE_CONFORMANCE.md`
6. the relevant proof doc (`docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/release/product-hardening-ticket-template.md`, or `docs/rehearsal/failure-ticket-template.md`)

Do not use the stale / OS-era docs listed in `docs/DOC_INDEX.md` as default context unless the task explicitly targets historical cleanup or legacy shell behavior.

## Legal attribution
- Attribution must reference **Connor Angiel** only.
- Do not introduce trademark claims or trademark symbols (use plain words like `TM` / `registered symbol` only when necessary; avoid symbols).

## Change discipline
- Small, reversible changes only
- One logical change per commit
- No speculative refactors
- Any completed phase or meaningful change requires updating `AI_STATE.md` with a factual Change Log entry
- For IDE boot emergency workstreams, commit messages must use these prefixes: `boot:`, `ide:`, `gates:`, `config:`, `docs:`
- Repo drift signal policy:
  - After each 1-3 commits run `pnpm repo:status` and `git status -sb`.
  - If local ahead count exceeds 3, emit guidance and produce an updated bundle/patch handoff.
  - Ahead count does not block local feature work in this environment.

## Verification hygiene
- Do not claim completion without evidence.
- Definition of done for app/shared-package work is **tests + package boundary checks + production build path**.
- Required tiered gates before marking work done:
  - Tier 1 (focused correctness): targeted tests for touched subsystem.
  - Tier 2 (package/boundary safety): affected workspace package build(s) and public API/barrel checks (for example `pnpm rb-utils:public-api-gate` when touching `rb-utils` exports).
  - Tier 3 (deploy safety): run `pnpm build:unified` for changes touching `rb-apps`, `rb-utils`, export/import flow, shared frontend code, or anything consumed by `apps/playground`.
- Do not skip Tier 3 for app/shared-package changes.
- If push output shows branch-protection checks were bypassed (for example missing required status checks), treat this as release-process debt and log it in `AI_STATE.md` until checks are enforced.
- PR/session evidence block must include:
  - `pnpm repo:status` output
  - Screenshot of `/` (IDE default)
  - Screenshot of `/?launcher=1` (Shell launcher)
  - First 30 console lines showing `[RB_BOOT]` mode selection
- In this environment, remote operations are disallowed; commit locally and push in normal remote-enabled workflows.

## Environment
- Do not run `npm install`; use pnpm only for required validation commands.
- Ignore any automated setup output that attempts npm installs or git remote operations; do not repeat those actions.
- pnpm may print warnings about ignored build scripts (for example, esbuild); this is expected from automation. Approve or run required builds explicitly with pnpm when needed.
