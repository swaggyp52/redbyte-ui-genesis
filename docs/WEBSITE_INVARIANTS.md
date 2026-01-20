# Website Invariants

The website is a read-only frontend for the same deterministic system. It must
never claim capabilities that the OS does not provide.

## Source of truth
- Commands and feature flags come from `apps/manual-site/src/content/mvpFacts.ts`.
- Bundle schema references must match `docs/STUDENT_EXPORT_SCHEMA.md`.

## Content rules
- No "planned" or speculative claims without matching implementation.
- All commands shown are copyable and runnable without edits.
- Any anchors used in nav must exist in page markup.

## Sanity check
- Run `pnpm --dir apps/manual-site run sanity` before deploy.
