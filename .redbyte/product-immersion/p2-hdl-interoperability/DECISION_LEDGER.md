# P2 Decision Ledger

Append-only record of irreversible or contract-shaping decisions. Each entry:
context → decision → rationale → reversibility.

---

## D-001 — Project format gets an explicit, monotonic `formatVersion`

- **Context.** P1 persisted state via a runtime envelope with ad-hoc, field-by-field
  fallback merging. There is no single declared format version, so future schema
  changes cannot be reasoned about or migrated safely.
- **Decision.** Introduce a single canonical project document with an explicit
  integer `formatVersion`, a deterministic serializer, and an ordered migration
  registry (`vN -> vN+1`). Deserialize = detect version → run migrations to current →
  validate. The runtime persist path adopts the same versioned document.
- **Rationale.** A migration-safe contract is the precondition for every later P2
  capability (source model, filesets, imported snapshots). Round-trip safety must be
  provable before we widen what the format carries.
- **Reversibility.** Additive and reversible while unreleased. Once real user
  projects exist at a version, that version's migration must be preserved forever.

## D-002 — P1 candidate (PR #82) is not merged in this session

- **Context.** The P2 directive asked to merge PR #82 into `product/redbyte-workbench-v3`
  and close it. This session's harness scopes pushes to
  `claude/redbyte-product-core-convergence-n3pi6t` and forbids other branches; PR #82
  is a draft on the protected product base.
- **Decision.** Leave PR #82 as the reviewed P1 candidate. Stack P2 on the P1 head so
  nothing is lost; Connor merges/closes #82 via the GitHub UI when ready.
- **Rationale.** Respect the session branch scope and avoid an irreversible write to a
  protected branch the session is scoped away from. Stacking is lossless.
- **Reversibility.** Fully reversible: P2 shares the P1 commits; merging #82 later
  collapses the P2 diff automatically.

<!-- Newer decisions appended below. -->
