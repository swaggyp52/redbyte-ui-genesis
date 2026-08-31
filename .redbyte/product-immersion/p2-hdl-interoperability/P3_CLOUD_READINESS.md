# P3 Cloud Control-Plane — Data-Contract Readiness Report

> **Report only.** This document assesses how ready RedByte's *data contracts*
> are for a future cloud control plane (multi-device projects, shared classroom
> records, server-side evidence). It implements nothing. **No authentication, no
> account model, and no server are built or proposed for implementation here** —
> that is deliberately out of scope until Connor authorizes P3.

## Purpose

A cloud control plane would let a project, its sources, its verification/export
evidence, and its imported snapshots exist beyond a single browser's local
storage — synced across devices and, in a classroom, associated with a person
and a course. Before any of that is built, its *data contracts* must be stable,
versioned, deterministic, and honestly tiered. This report scores the current
state against those preconditions.

## Current data authorities (the substrate a control plane would sync)

| Authority | Versioning | Determinism | Cloud-readiness note |
|-----------|-----------|-------------|----------------------|
| Project format (`RBProject`) | **Versioned + migration ladder (P2-1)** | Canonical encode, byte-stable | Ready as a synced document; migration-safe. |
| Source/fileset model (`sourceModel`) | Additive optional field; model `schemaVersion 1.0` | `normalizeProjectSourceModel` stable sort | Ready; the breaking v1→v2 promotion is staged (P2-8). |
| Hardware mapping (`hardwareMappingV2`) | `schemaVersion 2.0` | Deterministic | Ready. |
| Verify/export history | Bounded rings in the store | Deterministic entries | Ready as append-only records. |
| Vivado digital-twin snapshot (P2-7) | `schemaVersion 1.0` | Byte-stable serialization; content-hashed artifacts | Ready as content-addressable evidence. |
| Runtime persist envelope | `version 5`, `merge`-based | Reconstruct-and-renormalize | Local only; a server schema is a P3 design task. |

## What a control plane needs, and where we stand

1. **Stable project identity.** `RBProject.meta.projectId` exists and is
   preserved through save/load. ✅ (a server would treat it as the sync key).
2. **Versioned, migratable documents.** Delivered for the project format
   (P2-1). ✅ New server-carried fields must extend the same ladder, never a
   parallel scheme.
3. **Content-addressable artifacts.** Deterministic serialization + SHA-256
   (deterministic zip, digital-twin artifact hashes). ✅ Suitable for a
   content-addressed blob store.
4. **Honest evidence tiers.** Browser-E0 vs imported-external are explicit in
   code (P2-3/6/7). ✅ A control plane must carry the tier with the evidence and
   never launder an imported tier into a native claim.
5. **Submission/record contract.** `ideSubmissionBundle` already emits a
   self-describing, hashed bundle (manifest + rbproj + verify records). ✅ This
   is the natural unit of a server-side "submission" record.

## Gaps (explicitly NOT to be closed as P3 auth work)

- **No identity/account model, by design.** There is no user, session, or
  credential concept, and none should be added until P3 is authorized.
- **No server persistence schema.** The runtime persist envelope is
  browser-local; a durable server schema (and IndexedDB migration, still a
  pending local project) is a P3 design task, not started here.
- **Portable scenario sidecar** transfer across browsers/archives remains
  unproven (carried from P1 debt).
- **File-save inclusion of `sourceModel`** for hand-authored (non-imported)
  sources is a P2-5 follow-on; imported projects already round-trip via
  `deriveSourceModel`.

## Recommended P3 sequence (for authorization — not implemented)

1. Freeze the **submission record contract** (identity key + document version +
   evidence tiers + artifact hashes) as the server's unit of truth.
2. Define a **server document schema** that *references* the existing versioned
   client documents rather than reshaping them (reuse the migration ladder).
3. Only then design identity/auth — as a separate, explicitly-authorized
   workstream. This report does not specify it.

## Honesty boundary

Nothing in P2 constitutes a production, hosted, or multi-user claim. The data
contracts are *ready to be synced*; the control plane that would sync them is
future work requiring Connor's authorization.
