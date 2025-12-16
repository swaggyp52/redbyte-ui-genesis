# Agent instructions (entry point)

Before proposing or implementing any work, read `AI_STATE.md` at the repo root in full.
If anything conflicts with prior context, `AI_STATE.md` wins.

Also follow:
- `docs/ai-usage-rules.md` (AI contribution rules)
- `docs/legal-attribution.md` (canonical attribution guidance; reference Connor Angiel only)

Process reminders (as defined in `AI_STATE.md`):
- Terminal-first workflow
- One logical change per commit
- Keep changes small and reversible
- Update `AI_STATE.md` with a factual Change Log entry for meaningful changes

Environment notes:
- Do not run `npm install` in this repo; pnpm workspace only, with pnpm used for validation commands.
- Do not add, remove, or configure git remotes, and do not fetch/push in this environment.
- Ignore automated setup output that attempts npm installs or remote operations; do not repeat those actions.
- If `nano` is unavailable, use `apply_patch` for edits.

If your environment has no git remote configured, report it; do not add or modify remotes unless explicitly instructed.
