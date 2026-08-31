# Project Format v1 → v2 — Breaking-Change Sign-off Request

**Status:** awaiting Connor's decision. **Not implemented.** This is the single
sign-off-gated item in the P2 program. Nothing in the P2 UI-integration branch
(`claude/redbyte-product-core-convergence-n3pi6t`, PR #84) performs this bump;
the format version is still **1** and both classroom golden export SHAs are
byte-identical there.

Prepared: 2026-08-31 (cloud session). Runtime for any execution: **Node 20.19.0
/ pnpm 10.24.0** (pinned).

---

## 1. Exact change proposed

Make the first-class **source model** authoritative and retire the legacy
`RBProject.hdl` toolchain-input field.

| | v1 (today) | v2 (proposed) |
|---|---|---|
| Source of truth for HDL/XDC/Tcl | `RBProject.hdl.sources[]` (legacy toolchain input); `sourceModel` is optional and additive | `RBProject.sourceModel` (first-class filesets); `hdl` removed on encode |
| Format version | `CURRENT_PROJECT_FORMAT_VERSION = 1` (`packages/rb-apps/src/export/projectFormatMigrations.ts:27`) | `= 2` |
| Migration ladder | `MIGRATION_V0_TO_V1` only | append `MIGRATION_V1_TO_V2` |
| Fileset of a source | v1 imports forced everything to `design`; corrected in P2-C so promotion now uses each language's natural fileset | unchanged — v2 formalizes it |

**The migration body already exists and is tested.**
`promoteToolchainInput(hdl)` (`packages/rb-apps/src/apps/ide/projectSourceModel.ts`)
is exactly the v1→v2 transform: it maps `hdl.sources[]` into `sourceModel.files[]`
with each source in its language's natural fileset (RTL → `design`, XDC →
`constraint`, Tcl → `utility`) in the `work` library, carrying `hdl.top` to
`sourceModel.topEntity`. `deriveSourceModel(project)` already returns the
promoted model, so **every reader in the app is already source-model-first** — v2
only changes what `encodeRBProject` writes and drops `hdl`.

Scope of the actual v2 diff (small and mechanical):
1. `CURRENT_PROJECT_FORMAT_VERSION` `1 → 2`.
2. Add `MIGRATION_V1_TO_V2` (wrap `promoteToolchainInput`; stamp version 2).
3. `encodeRBProject`: emit `sourceModel`, stop emitting `hdl`.
4. Regenerate the two committed golden SHAs (see §2).
5. Migration-corpus fixtures: add a `v2-canonical.json` and a `v1→v2` round-trip case.

---

## 2. Affected goldens

Exactly two committed classroom golden export SHAs change, because dropping
`hdl` and emitting `sourceModel` changes the bytes of the generated project
archive inside the export ZIP:

- `packages/rb-apps/src/__tests__/__goldens__/golden-basys3-switch-and.zip.sha256`
  (gate: `classroom-golden-basys3-export-gate.test.ts`)
- `packages/rb-apps/src/__tests__/__goldens__/golden-basys3-alu.zip.sha256`
  (gate: `classroom-golden-basys3-alu-export-gate.test.ts`)

Both gates already support deliberate regeneration:
`UPDATE_GOLDEN_BASYS3_ZIP_SHA=1 <run the gate>` rewrites the `.sha256` file. This
**must** be run once, intentionally, on the pinned Node 20.19.0 runtime, and the
regenerated SHAs reviewed and committed as part of the v2 change — never silently.

No other golden or determinism gate depends on `hdl` vs `sourceModel` byte layout
(the round-trip/determinism gates compare `decode(encode(p))` structurally, which
stays lossless — see §3).

---

## 3. Migration & round-trip

- **Forward (load):** any stored v1 (or v0) project loads unchanged — the
  migration ladder runs at `normalizeRBProject`'s choke point, and
  `promoteToolchainInput` is total and lossless (all source text preserved
  verbatim, ids derived from paths, deterministic order). Already covered by the
  P2-1 migration tests; a `v1→v2` case is the only new fixture.
- **Encode:** v2 documents serialize `sourceModel` and omit `hdl`. Serialization
  stays canonical/byte-stable (no wall-clock, no random ids), so the new goldens
  are themselves deterministic.
- **Round-trip:** `decode(encode(p)) ≡ normalize(p)` continues to hold because the
  source model is a superset of the legacy `hdl` view.

---

## 4. Rollback

- **In-repo rollback:** revert the version bump + `encodeRBProject` change + the
  two regenerated `.sha256` files. Because v1 decode is retained on the ladder,
  reverting is a clean git revert with no data migration.
- **Downgrade for old clients:** older RedByte builds cannot read a v2 file
  (they have no `sourceModel`-authoritative decode and will see version 2 >
  supported). Two options, to be chosen at implementation time:
  - **(a) Hard cut** — v2 files are simply unreadable by pre-v2 builds
    (`migrateRBProjectDocument` already rejects newer-than-supported with an
    honest message). Simplest; acceptable once all shipping builds are ≥ v2.
  - **(b) Dual-emit bridge** — v2 also emits a projected `hdl` block for one
    release so old builds keep reading, then drop it. Safer for a staged rollout;
    slightly larger files during the bridge window.

---

## 5. User-data risk

- **No data loss.** The transform preserves every source's text, language,
  library, and the top entity. Existing saved v1 projects keep working (forward
  migration).
- **Forward-incompatibility.** After v2, a project saved by a new build cannot be
  opened by an older build (unless option 4(b) is chosen). This is the real user
  risk and the reason for the sign-off gate.
- **Classroom re-certification.** The two golden SHAs change, so any
  TA-facing/classroom certification that pins those SHAs must be re-run and
  re-attested on the pinned runtime. This is a process cost, not a code risk.
- **Browser-local persistence** is unaffected (the runtime persist envelope is a
  separate concern from the export format and is not versioned by this change).

---

## 6. Recommended decision

**Proceed with v2 as its own small, reviewed change — after explicit sign-off —
and NOT bundled into the P2 UI-integration branch.** Rationale:

1. The migration body is already written and tested; the remaining diff is
   mechanical (version bump + encode change + regenerated goldens + one fixture).
2. Keeping it separate preserves P2's invariant that the two classroom goldens
   stay byte-identical throughout the UI work, so any golden drift in P2 review is
   unambiguously a regression, never this intentional bump.
3. Choose rollout option **4(b) (dual-emit bridge)** if any shipping build in the
   field must keep reading new saves during the transition; otherwise **4(a)**.

Nothing here executes until Connor approves. On approval, the v2 change lands on a
dedicated branch with the regenerated SHAs and re-certification noted in the PR.
