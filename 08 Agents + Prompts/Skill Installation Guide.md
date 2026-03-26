---
type: handoff
status: active
area: infrastructure
updated: 2026-03-25
related:
  - "[[redbyte-obsidian-maintainer SKILL]]"
  - "[[Hook Integration Plan]]"
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
---

# Skill Installation Guide

---

## redbyte-obsidian-maintainer

**Draft location:** `08 Agents + Prompts/redbyte-obsidian-maintainer SKILL.md`

**Installed at:** `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` ✅

### What the skill does

Maintains the RedByte Obsidian vault as a structured engineering brain. When invoked, it:

1. Checks Canonical Notes Policy for source-of-truth notes
2. Updates canonical notes before creating new ones
3. Enforces Properties frontmatter on every note it touches
4. Updates hub notes with new links and status
5. Reports created/updated notes with rationale and workspace routing

### How to invoke

Direct invocation:
```
Run Obsidian Maintainer
Update the vault
Run maintenance pass
```

Should auto-trigger when relevant (after test runs, bug diagnosis, implementation). The skill description is tuned to fire on those contexts.

### When to use

- After any test run (pass or fail)
- After diagnosing a bug
- After an implementation that changed system behavior
- After discovering a new architecture constraint
- When creating a handoff for the next session

### Installation steps

1. Copy `08 Agents + Prompts/redbyte-obsidian-maintainer SKILL.md` to `.claude/skills/redbyte-obsidian-maintainer/SKILL.md`
2. The `.claude/skills/` directory is managed by Claude Code — verify write permissions before copying
3. Restart the session (or run `/reload`) for the skill to be picked up
4. Verify by invoking: "Run Obsidian Maintainer" — Claude should acknowledge the skill and begin a documentation pass

### Verification

After installation, run:
```
/skills
```
`redbyte-obsidian-maintainer` should appear in the list.

---

## Future skills to consider

| Skill | Purpose |
|---|---|
| `redbyte-test-runner` | Wrap pnpm vitest invocation with automatic post-run extraction |
| `redbyte-adr-writer` | Guide Claude through structured ADR creation with correct schema |
| `redbyte-handoff-writer` | Create a handoff note from current session state |
