---
type: decision
status: active
area: export
updated: 2026-03-25
related:
  - "[[Connection Model]]"
  - "[[BUG-001 Connection Fixture Format Mismatch]]"
  - "[[Export Contracts]]"
---

# ADR-001 — Enforce Structured Connection Format

**Date:** 2026-03-25
**Status:** Accepted
**Decider:** Engineering (surfaced via autonomous test run)

---

## Context

The RedByte circuit model uses `Connection` objects to describe wires between nodes. During an autonomous test run, 46 of 49 export authority chain contract tests failed because a test fixture used an invalid flat connection shape (`fromNodeId`, `toNodeId`) that the production validator has never supported.

This surfaced a latent risk: test fixtures that use non-canonical shapes compile fine (TypeScript accepts extra fields or loose `as` casts), run silently past linting, but fail at runtime when the validator enforces the real schema.

---

## Problem

Two competing mental models existed in the codebase:

**Model A (flat, incorrect):**
```typescript
{ fromNodeId: 'sw0', fromPort: 'out', toNodeId: 'ld0', toPort: 'in' }
```

**Model B (nested, correct):**
```typescript
{ from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'ld0', portName: 'in' } }
```

Model A was never valid in production. It appeared in test fixtures only, where TypeScript's structural typing allowed it to pass as `RBProject['circuit']` without error.

---

## Options Considered

### Option 1 — Add legacy flat-shape support to `normalizePortRef`
Add handling for `connection.fromNodeId` and `connection.toNodeId` at the top level.

**Rejected.** This would permanently add dead-code support for a format that was never in production data. It increases validator complexity with no real-world benefit.

### Option 2 — Fix the test fixtures (chosen)
Update `makeMinimalCircuit()` in the test file to use the correct nested shape.

**Accepted.** The fixture was wrong; the validator is correct. Fix the fixture.

### Option 3 — Add a lint rule to block flat-shape connections
Write an ESLint rule or TypeScript branded type to prevent `fromNodeId` on connection objects.

**Deferred.** Worth doing eventually, but the immediate fix is to correct the fixture.

---

## Decision

**Fix the fixture. The canonical connection shape is `{ from: { nodeId, portName }, to: { nodeId, portName } }`. No exceptions.**

The `normalizePortRef` function supports two legacy input shapes for deserialization of old project files, but these are reading aids — they are not writing contracts for new code.

---

## Consequences

- Test fixtures must always use the nested shape going forward
- Any new test that constructs a `Connection` manually must use `{ from: { nodeId, portName }, to: { nodeId, portName } }`
- The flat shape is documented as non-existent — future contributors must not introduce it
- 49/49 export authority chain contract tests now pass

---

## Enforcement Going Forward

Until a lint rule exists, enforce by convention:
1. Code review: flag any `fromNodeId` or `toNodeId` on a top-level connection object
2. Prefer `createConnection(fromNodeId, fromPort, toNodeId, toPort)` helper if one is introduced

---

## Related

- [[Connection Model]] — canonical shape and validator behavior
- [[BUG-001 Connection Fixture Format Mismatch]] — the bug this decision resolves
- [[Export Contracts]] — the test suite that surfaced the failure
