# AI usage rules (repo-local)

## Authority
- `AI_STATE.md` at the repo root is authoritative. If anything conflicts, `AI_STATE.md` wins.

## Architectural invariants
- OS metaphor is canonical: **boot -> desktop -> apps**
- Monorepo structure is permanent; packages remain modular and independent
- Terminal-first development only
- `main` is production (Cloudflare Pages auto-deploy)

## Legal attribution
- Attribution must reference **Connor Angiel** only.
- Do not introduce trademark claims or trademark symbols (use plain words like `TM` / `registered symbol` only when necessary; avoid symbols).

## Change discipline
- Small, reversible changes only
- One logical change per commit
- No speculative refactors
- Any completed phase or meaningful change requires updating `AI_STATE.md` with a factual Change Log entry
- For IDE boot emergency workstreams, commit messages must use these prefixes: `boot:`, `ide:`, `gates:`, `config:`, `docs:`
- Hard-stop repo drift policy:
  - After each 1-3 commits run `pnpm repo:status` and `git status -sb`.
  - If local ahead count exceeds 3, stop feature work immediately.
  - Push, or create a bundle/patch handoff and get it applied/pushed before continuing.

## Verification hygiene
- Do not claim completion without evidence.
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
