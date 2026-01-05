# Archive — Historical Documentation

**Purpose:** Preserve historical documents for context, not active maintenance.

This directory contains documentation that is **no longer current** but remains valuable for understanding:
- Why decisions were made
- How the project evolved
- What was tried and abandoned
- Development milestones

---

## What Goes in the Archive

### ✅ Archive When:

1. **Replaced by canonical docs** — Old version superseded by `/00-canon/` docs
2. **Development logs** — Session summaries, milestone reports
3. **Obsolete designs** — Features that were planned but not implemented or changed
4. **Historical versions** — Old PDFs, specs, design docs with newer versions available

### ❌ Do Not Archive:

1. **Current documentation** — Belongs in `/00-canon/`, `/01-dev/`, etc.
2. **Incomplete work** — Belongs in `/99-placeholders/`
3. **Personal notes** — Not documentation, delete or keep in private notes

---

## Archive Contents

### `/session-logs/` — Development Session Logs

Historical development summaries showing progress over time.

| File | Date | Content | Reason Archived |
|------|------|---------|-----------------|
| [SESSION_SUMMARY.md](./session-logs/SESSION_SUMMARY.md) | Unknown | Chip system implementation notes | Development log, not canonical |
| [STAGE0_COMPLETE.md](./session-logs/STAGE0_COMPLETE.md) | Unknown | Milestone: Monorepo init, boot sequence, windowing | Milestone report, historical record |

**Value:** Shows how features were built incrementally, useful for understanding implementation evolution.

### `/pdf-versions/` — Historical Specification Versions

Previous versions of product specifications and design documents.

**Status:** TODO — Need to consolidate duplicate PDFs from root directory

**What should go here:**
- `RedByte OS & Logic Playground – Product and Systems Specification.pdf` (version 1, 2, etc.)
- `Deterministic Interactive Computation in the Browser.pdf` (if superseded)
- Any other PDFs with " - Copy" or "(1)" suffixes

**Naming convention:**
- `product-spec-v1-YYYY-MM-DD.pdf`
- `product-spec-v2-YYYY-MM-DD.pdf`
- Keep most recent version in root, move older versions here

### `/obsolete/` — Abandoned Features & Designs

Documentation for features that were designed but never implemented, or implemented then removed.

**Status:** Empty (no obsolete docs yet)

**Examples of what would go here:**
- "Multiplayer circuit building" design (if abandoned)
- "Real-time collaboration" spec (if deferred indefinitely)
- "Cloud rendering" architecture (if decided against)

---

## How to Archive a Document

### Step 1: Add "ARCHIVED" status label

At the top of the document:

```markdown
**Status:** ARCHIVED
**Archived Date:** YYYY-MM-DD
**Reason:** [Why it was archived]
**Superseded By:** [Link to replacement doc, if any]
```

### Step 2: Move to appropriate archive subdirectory

```bash
mv docs/old-doc.md docs/05-archive/obsolete/old-doc.md
```

### Step 3: Update links

Search for references to the archived document:

```bash
grep -r "old-doc.md" docs/
```

Update links to either:
- Point to new canonical doc (if superseded)
- Point to archived location (if historical reference)
- Remove link (if no longer relevant)

### Step 4: Add entry to this README

Document what was archived, when, and why.

---

## Retrieval

If you need to reference archived documentation:

1. **Find it here** — Browse `/05-archive/` subdirectories
2. **Check why it was archived** — Read the "ARCHIVED" status label
3. **Find replacement** — Follow "Superseded By" link if available
4. **Understand historical context** — Read for evolution, not current truth

**Warning:** Archived docs may contain outdated information. Always verify against current canonical docs.

---

## Retention Policy

**Keep forever:**
- Milestone reports (STAGE0_COMPLETE, etc.)
- Major design decision documents
- Specification versions (at least 3 most recent)

**Delete after 2 years:**
- Session logs with no significant decisions
- Duplicate copies with no meaningful differences
- Personal notes mistakenly committed

**Review annually:**
- Check if archived docs still have historical value
- Consolidate similar documents
- Update this README with findings

---

## Changelog

- **2026-01-05**: Archive initialized
  - Moved SESSION_SUMMARY.md to session-logs/
  - Moved STAGE0_COMPLETE.md to session-logs/
  - Created archive structure (session-logs, pdf-versions, obsolete)
  - Defined archival policy
