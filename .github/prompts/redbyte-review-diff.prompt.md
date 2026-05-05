# RedByte - Review Diff Prompt

Use this prompt to review a git diff before committing or creating a PR.

---

## Input

Run first:

```
git diff HEAD
git diff --name-only HEAD
git status --short
```

## Step 1 - Classify touched files

For each changed file, categorize as:

- `PRODUCT_UI` - packages/rb-apps/src/**
- `CONTROL_DOC` - AI_STATE.md, docs/product/**, docs/ACTIVE_WORK.md
- `AGENT_TOOL` - scripts/rb-*.mjs, .redbyte/agent/**
- `SPEC_DOC` - docs/ide/**, docs/manuals/**
- `TEST` - **/__tests__/**
- `CONFIG` - package.json, tsconfig.json, vitest.config.ts, etc.
- `INFRA` - .github/**, .gitignore, pnpm-workspace.yaml

## Step 2 - Check source hierarchy

- Are control docs (`RED_BYTE_CURRENT_TRUTH.md`, `ACTIVE_WORK.md`, `AI_STATE.md`) updated if product behaviour changed?
- Is `DOC_INDEX.md` updated if a new durable doc was added?
- Is `last_validated` updated in frontmatter if a canonical doc changed?

## Step 3 - Check product trust claims

- No copy conflates Draft Export with Trusted Export.
- No copy conflates mapped hardware with verified trust.
- NEEDS REVIEW chips name specific fix paths, not generic messages.
- No new product features claimed beyond current proof matrix.

## Step 4 - Check tests and validation

- Does every new UI behaviour have a test?
- Do tests use correct fixture states (incomplete rows for incomplete-state renders, complete rows for complete-state renders)?
- Are gates confirmed passing?
- Is build confirmed passing?
- Are claims backed by terminal output (not assumptions)?
- If any command failed, is the exact command and error output recorded?
- For local-agent changes, did `pnpm rb:agent:ollama:doctor` pass before `rb:agent:next`?
- For control-loop or product-claim changes, did `pnpm rb:control:next` and `pnpm rb:control:trace-claims` run where relevant?
- Are generated memory/control reports treated as evidence candidates rather than canonical docs?
- If JSON mode is claimed, is the produced output parseable JSON with required command keys?

## Step 5 - Identify risky broad edits

Flag:
- Surface rewrites affecting more than one workflow step
- Changes to `projectWorkflowAuthority` without explicit scope
- Additions to `IDE_EXAMPLES` or `LAB_STARTERS` without matching vectors and ioRows
- Doc changes that make claims beyond the current proof matrix

## Step 6 - Recommend

One of:

- **COMMIT** - diff is clean, tests pass, docs updated, bounds respected
- **HOLD** - specific issue(s) must be resolved first (list them)
- **SPLIT** - diff mixes unrelated changes and should be separated into focused commits
