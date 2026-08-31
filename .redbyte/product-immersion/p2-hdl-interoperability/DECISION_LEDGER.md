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

## D-003 — Decode attaches a hierarchy only when the document carries one

- **Context.** `normalizeRBProject` (decode) unconditionally synthesized a default
  hierarchy (`{activeModuleId:'top', modules:[], ...}`) via `normalizeProjectHierarchy`,
  while `encodeRBProject` emits `hierarchy` only when present. A hierarchy-less
  project therefore gained a `hierarchy` field on decode, so `encode∘decode` was not
  idempotent — the canonical round-trip-safety defect P2-1 exists to close.
- **Decision.** On decode, attach a hierarchy only when the document actually carries
  one, or when legacy `customComponents` must be promoted into modules; otherwise
  leave `hierarchy` undefined, mirroring encode. The guard lives on the decode side,
  so the byte-identical encode path (golden export gates) is untouched.
- **Rationale.** Symmetric encode/decode is the definition of a round-trip-safe
  format. This restored three previously-red gates (`export-reimport-roundtrip`,
  `rbproject-roundtrip-gate`, `project-determinism-gate`) to green against their
  *committed* goldens — i.e. the goldens were correct and the code had drifted; this
  is a correctness restoration, not a re-baseline.
- **Reversibility.** Reversible; `RBProject.hierarchy` is already optional and encode
  already produced hierarchy-less projects, so consumers already tolerate undefined.

## D-004 — Vivado folder round-trip constraint asymmetry deferred to P2-5/P2-7

- **Context.** `ide-vivado-project-folder-contract` asserts a Vivado project-folder
  export re-imports to the exact same normalized project. It stays red because the
  folder import reconstructs `fpga.constraints.text` from the emitted `top.xdc`,
  whereas the embedded `project.rbproj.json` manifest carried no constraints. The
  RBProject codec itself round-trips (manifest decode∘encode is idempotent — proven);
  the asymmetry is in the Vivado import/export contract.
- **Decision.** Classify as a cross-subsystem fidelity gap and defer to P2-5 (Import
  program: "manifest is authoritative" semantics) and P2-7 (constraint-set model).
  Do not re-baseline, do not alter the RBProject codec to paper over it, do not widen
  P2-1's blast radius.
- **Rationale.** The correct fix is a deliberate import-semantics + constraint-set
  design decision, not a format-versioning concern. Pre-existing at the branch base.
- **Reversibility.** N/A (no change made); the gate remains as a tracked P2-5/P2-7 target.

<!-- Newer decisions appended below. -->
