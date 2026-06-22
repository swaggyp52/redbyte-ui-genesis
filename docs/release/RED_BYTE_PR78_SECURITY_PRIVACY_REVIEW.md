---
doc_status: current
last_validated: 2026-06-22
owner: Connor Angiel
used_by_claude: true
role: PR78 Product Trust Reset v2 security and privacy review
---

# RedByte PR78 Security and Privacy Review

This review covers draft PR #78 during Product Trust Reset v2 Phase 3I. It is a local-first browser review, not a formal penetration test.

## Scope

Reviewed:

- Help / Diagnostics support data boundary
- project storage facade and recovery data
- backup/export download paths
- imported project handling at a high level
- generated artifact previews
- browser storage and network posture

Not reviewed:

- third-party dependency audit
- full XSS fuzzing of every imported label/file path
- hosted Cloudflare runtime headers beyond existing build/deploy gates
- hardware bridge security

## Findings

| Area | Finding | Severity |
|---|---|---|
| Credentials/tokens | No Phase 3I code adds account login, credentials, tokens, or backend sync. | None |
| Network | The core IDE remains local-first. Existing hardware/ops clients are opt-in paths outside normal Design/Verify use. | P2 boundary to preserve |
| Diagnostics | Help / Diagnostics exposes build fingerprint, runtime/browser context, RedByte storage key names, storage health, quota state, and recovery metadata. It does not include raw project bytes by default. | Accept |
| Storage | Browser storage remains local. The facade adds journal/LKG/recovery sidecars and Diagnostics visibility without adding external upload. | Accept |
| Backup download | Storage backup uses a sanitized project-name download stem through the existing download path. | Accept |
| Generated previews | Export uses syntax-highlighted HTML in `dangerouslySetInnerHTML` for generated artifact preview. Phase 3I did not prove an injection bug, but this should receive a focused escaping/highlighter review before non-draft release. | P2 |
| Import handling | Existing import gates preserve corrupt-import safety and no automatic trusted PASS. Phase 3I did not change parser/apply semantics. | Accept |
| CSP / third-party | No new third-party runtime dependency or account service was added in Phase 3I. | Accept |

## Required Boundaries

- Do not place raw project contents in diagnostics by default.
- Do not upload diagnostics or backups without explicit user action.
- Do not trust imported Verify PASS without rerun freshness checks.
- Keep hardware/bridge network access opt-in to hardware/proof contexts.
- Sanitize any future downloaded filenames derived from project labels.
- Review syntax highlighting escape behavior before marking PR #78 non-draft.

## Decision

No Phase 3I P0/P1 security or privacy blocker was found. The remaining security work is P2: focused generated-preview escaping review and a clean non-draft dependency/header pass.

## Attribution

Connor Angiel
