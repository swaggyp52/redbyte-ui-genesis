# RedByte â€” Review Diff Prompt

Use this prompt to review a git diff before committing or creating a PR.

---

## Input

Run first:

```
git diff HEAD
git diff --name-only HEAD
git status --short
```

## Step 1 â€” Classify touched files

For each changed file, categorize as:

- `PRODUCT_UI` â€” packages/rb-apps/src/**
- `CONTROL_DOC` â€” AI_STATE.md, docs/product/**, docs/ACTIVE_WORK.md
- `AGENT_TOOL` â€” scripts/rb-*.mjs, .redbyte/agent/**
- `SPEC_DOC` â€” docs/ide/**, docs/manuals/**
- `TEST` â€” **/__tests__/**
- `CONFIG` â€” package.json, tsconfig.json, vitest.config.ts, etc.
- `INFRA` â€” .github/**, .gitignore, pnpm-workspace.yaml

## Step 2 â€” Check source hierarchy

- Are control docs (`RED_BYTE_CURRENT_TRUTH.md`, `ACTIVE_WORK.md`, `AI_STATE.md`) updated if product behaviour changed?
- Is `DOC_INDEX.md` updated if a new durable doc was added?
- Is `last_validated` updated in frontmatter if a canonical doc changed?

## Step 3 â€” Check product trust claims

- No copy conflates Draft Export with Trusted Export.
- No copy conflates mapped hardware with verified trust.
- NEEDS REVIEW chips name specific fix paths, not generic messages.
- No new product features claimed beyond current proof matrix.

## Step 4 â€” Check tests and validation

- Does every new UI behaviour have a test?
- Do tests use correct fixture states (incomplete rows for incomplete-state renders, complete rows for complete-state renders)?
- Are gates confirmed passing?
- Is build confirmed passing?
- Are claims backed by terminal output (not assumptions)?
- If any command failed, is the exact command and error output recorded?

## Step 5 â€” Identify risky broad edits

Flag:
- Surface rewrites affecting more than one workflow step
- Changes to `projectWorkflowAuthority` without explicit scope
- Additions to `IDE_EXAMPLES` or `LAB_STARTERS` without matching vectors and ioRows
- Doc changes that make claims beyond the current proof matrix

## Step 6 â€” Recommend

One of:

- **COMMIT** â€” diff is clean, tests pass, docs updated, bounds respected
- **HOLD** â€” specific issue(s) must be resolved first (list them)
- **SPLIT** â€” diff mixes unrelated changes and should be separated into focused commits
