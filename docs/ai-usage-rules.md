# AI usage rules (repo-local)

## Authority
- Current owner instructions and `AGENTS.md` govern scope. Current code and tests establish behavior;
  `AI_STATE.md` and `docs/ACTIVE_WORK.md` record status and evidence, including historical entries.

## Architectural invariants
- IDE-first product truth is canonical: default `/` boots the six-surface IDE, while `/?launcher=1` is an explicit legacy/dev shell path and not the default product narrative.
- Monorepo structure is permanent; packages remain modular and independent
- Use the terminal for source/build checks and the available native browser for hands-on product inspection.
- `main` is production (Cloudflare Pages auto-deploy)

For product work, use the task-specific routing in `AGENTS.md`: relevant product contract/manual
sections, affected surface spec, and applicable proof obligations. Read system maps for cross-surface
changes and release checklists for release work; do not load the full history or every reference.

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
- Remote operations are disallowed by default.
- Explicit user authorization may allow normal non-force GitHub operations, including `git push origin main`, GitHub Actions inspection, and branch protection/ruleset inspection.
- Force push remains forbidden.
- Branch protection or ruleset edits require extra caution, current remote proof, and documentation of old contexts, new contexts, and replacement coverage.

## Environment
- Do not run `npm install`; use pnpm only for required validation commands.
- Ignore any automated setup output that attempts npm installs or git remote operations; do not repeat those actions.
- pnpm may print warnings about ignored build scripts (for example, esbuild); this is expected from automation. Approve or run required builds explicitly with pnpm when needed.
