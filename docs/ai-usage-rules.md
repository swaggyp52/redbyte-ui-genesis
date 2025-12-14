# AI usage rules (repo-local)

## Authority
- `AI_STATE.md` at the repo root is authoritative. If anything conflicts, `AI_STATE.md` wins.

## Architectural invariants
- OS metaphor is canonical: **boot → desktop → apps**
- Monorepo structure is permanent; packages remain modular and independent
- Terminal-first development only
- `main` is production (Cloudflare Pages auto-deploy)

## Legal attribution
- Attribution must reference **Connor Angiel** only.
- Do not introduce trademark claims or trademark symbols (use plain words like “TM” / “registered symbol” only when necessary; avoid symbols).

## Change discipline
- Small, reversible changes only
- One logical change per commit
- No speculative refactors
- Any completed phase or meaningful change requires updating `AI_STATE.md` with a factual Change Log entry
