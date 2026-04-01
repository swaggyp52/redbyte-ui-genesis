---
type: architecture
status: active
area: infrastructure
updated: 2026-04-01
related:
  - "[[RedByte Engineering Brain]]"
  - "[[Canonical Notes Policy]]"
---

# Note Schema

This is the canonical metadata schema for all notes in the RedByte vault. Every note Claude creates or updates must open with a Properties block matching one of these schemas. Consistent field names are required for Bases and Dataview to function correctly.

---

## Bug Note

```yaml
---
type: bug
status: open          # open | investigating | blocked | fixed | done
area: verify          # verify | export | design | hardware | import | project | bridge | vivado | infrastructure | other
priority: high        # low | medium | high | critical
source: test-run      # test-run | manual-debug | implementation | discussion
updated: YYYY-MM-DD
related:
  - "[[Architecture Note]]"
  - "[[Decision Note]]"
---
```

**Body sections required:**

- `## Summary` — one-sentence description of the failure
- `## Root Cause` — what actually went wrong
- `## System Truth` — what must be true for the system to work
- `## Fix` — what was changed
- `## Links` — architecture and decision notes it touches

---

## Architecture Note

```yaml
---
type: architecture
status: active        # active | draft | deprecated
area: verify          # verify | export | design | hardware | import | project | bridge | vivado | infrastructure | other
updated: YYYY-MM-DD
related:
  - "[[Other Architecture Notes]]"
  - "[[Relevant Bugs]]"
  - "[[Relevant ADRs]]"
---
```

**Body sections required:**

- `## Overview` — what this system does and why it exists
- `## Canonical Shape / Contract` — the exact interface or data shape
- `## Rules` — constraints that must always hold
- `## Consumption Sites` — where this is used in the codebase
- `## Open Questions / Stubs` — known gaps

---

## Decision Note (ADR)

```yaml
---
type: decision
status: active        # active | superseded
area: verify          # verify | export | design | hardware | import | project | bridge | vivado | infrastructure | other
updated: YYYY-MM-DD
related:
  - "[[Architecture Note]]"
  - "[[Bug Note]]"
---
```

**Body sections required:**

- `## Context` — what situation forced a decision
- `## Options Considered` — what alternatives existed
- `## Decision` — what was chosen and why
- `## Consequences` — what this enables or forecloses

---

## Handoff Note

```yaml
---
type: handoff
status: queued        # queued | active | done
area: verify          # verify | export | design | hardware | import | project | bridge | vivado | infrastructure | other
updated: YYYY-MM-DD
related:
  - "[[Bug Note]]"
  - "[[Architecture Note]]"
  - "[[Decision Note]]"
---
```

**Body sections required:**

- `## State at Handoff` — what is working, what is not, what was left mid-flight
- `## Open Work` — next actions in priority order
- `## System Constraints` — things the next session must not break
- `## Context Needed` — what reading is required before picking up

---

## Field Value Reference

| Field | Allowed Values |
|---|---|
| `type` | `bug`, `architecture`, `decision`, `handoff` |
| `status` (bug) | `open`, `investigating`, `blocked`, `fixed`, `done` |
| `status` (architecture) | `active`, `draft`, `deprecated` |
| `status` (decision) | `active`, `superseded` |
| `status` (handoff) | `queued`, `active`, `done` |
| `area` | `verify`, `export`, `design`, `hardware`, `import`, `project`, `bridge`, `vivado`, `infrastructure`, `other` |
| `priority` | `low`, `medium`, `high`, `critical` |
| `source` | `test-run`, `manual-debug`, `implementation`, `discussion` |

Do not invent alternate field names. Bases and Dataview break silently when field names drift.
