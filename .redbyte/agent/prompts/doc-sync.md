# RedByte Local Agent — Doc Sync Prompt

You are checking whether a completed implementation slice needs documentation or Obsidian updates.

## Input

You will be given:
- The git diff of the completed slice
- The current `AI_STATE.md` change log
- The current `ACTIVE_WORK.md`
- The work-driver packet

## Output

Produce a checklist of required updates. For each item, state:
- REQUIRED or OPTIONAL
- Which file to update
- What to add/change (be specific)
- Whether it has already been done (if you can tell from the diff)

## Checklist template

### Repo control docs

- [ ] `AI_STATE.md` — add change log entry for this slice
- [ ] `ACTIVE_WORK.md` — remove from Top 3 priorities if done; add proof entry
- [ ] `docs/product/RED_BYTE_CURRENT_TRUTH.md` — remove from open issues; add to "already fixed"
- [ ] `docs/product/RED_BYTE_WORK_QUEUE.md` — mark item as done with commit hash and date
- [ ] `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md` — mark friction codes as resolved if applicable
- [ ] `docs/IDE_PRODUCT_DEBT_REGISTER.md` — mark debt entry as resolved if applicable

### Obsidian Engineering Brain

- [ ] `01 Dashboard/RedByte Engineering Brain.md` — update in-flight section
- [ ] `05 Bugs/BUG-00N.md` — close or update any related bug note
- [ ] Session log — add completed slice summary

### Test evidence

- [ ] New test file created? Document it.
- [ ] Existing tests updated? Note which assertions changed and why.

### Gate evidence

- [ ] Which gates were run? Which passed?

## Format

For each REQUIRED item that has NOT been done:

```
MISSING: <file>
ACTION: <what to write>
```

For each item that IS already done:

```
DONE: <file>
```
