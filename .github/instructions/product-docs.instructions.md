---
applyTo: "docs/product/**/*.md,docs/ide/**/*.md,docs/manuals/**/*.md"
---

# RedByte — Product Documentation Rules

## Source hierarchy

When docs conflict, trust in this order:

1. Code and passing tests — ground truth
2. `docs/product/RED_BYTE_CURRENT_TRUTH.md` — canonical state snapshot
3. `docs/ACTIVE_WORK.md` — live priorities
4. `AI_STATE.md` — recent changes and session context
5. Surface specs (`docs/ide/0N-surface.md`) — surface-level behaviour

Docs must declare `doc_status: current` and `used_by_claude: true` in YAML frontmatter to be treated as canonical.

## Writing rules

- Mark clearly: **Current truth** vs **Target state** vs **Historical audit**. Do not blend them.
- Avoid stale roadmap claims — if something is not shipped, say so explicitly.
- Keep tone direct and technical. No marketing hype.
- Do not promise hardware/Vivado behaviour that has not been proven end-to-end.

## Structural rules

- Update `docs/DOC_INDEX.md` when adding any durable new doc.
- Update `last_validated` in frontmatter whenever a doc is materially changed.
- Do not create a new product truth doc when `docs/product/RED_BYTE_CURRENT_TRUTH.md` and `docs/ACTIVE_WORK.md` can carry the information.
- Do not duplicate full control docs into `.github/` — reference the canonical source instead.

## Stale zone

The following are explicitly superseded and must not be updated as if current:
- `docs/00-canon/00–08-*.md`
- `docs/STUDENT_WORKFLOW.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `PRODUCT.md` if it conflicts with current-truth docs
