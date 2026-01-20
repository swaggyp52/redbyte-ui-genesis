# File System Contract

RedByte treats files as deterministic artifacts, not ambient OS files. The file
model must be explicit, reproducible, and safe for lab submissions.

## Artifact classes
- source: editable logic or lab source (e.g., .rblogic)
- artifact: evidence output (trace, bundles, reports)
- derived: build outputs derived from source or artifact

## Storage surfaces
- Virtual Files app (localStorage key `rb:file-system`)
- Logic file store for circuits (localStorage key `rb:files:rblogic:v1`)
- Exported bundles (.rb-lab.zip) are the authoritative submission artifact

## Deterministic rules
- IDs are monotonic and non-random (e.g., `file-v2-<seq>`, `folder-<seq>`).
- Create never overwrites an existing entry; rename uses an explicit new name.
- Overwrites require derived_from provenance metadata.
- Deletes are explicit and irreversible (no silent garbage collection).
- Paths are explicit and normalized (no implicit current working directory).

## Required metadata
- schema_version (string)
- created_at (ISO-8601 string, metadata only)
- updated_at (ISO-8601 string, metadata only)
- created_by (app id or subsystem name)
- derived_from (optional origin reference)

## Non-goals
- No background sync or cloud filesystem.
- No implicit file generation; every artifact is a deliberate state transition.
