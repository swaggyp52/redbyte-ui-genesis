---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: RedByte PR78 jury retrial and fix package 001
---

# RedByte Jury Retrial 001

Date: 2026-06-23
Branch: `product/redbyte-trust-reset-v2`
Starting head: `502a163ae907d76a0fea473853adb8d80e864022`
Review type: agentic browser retrial, not human review

## Fix Package

The jury selected one coherent package: make the primary from-scratch Half Adder browser trial trustworthy and fix the mapping-authority defect it exposed.

Changed areas:

- Permanent jury institution: `.agents/jury/**`, `.agents/skills/redbyte-jury-orchestrator/SKILL.md`
- Focused browser gate: `scripts/gates/ide-jury-half-adder-visible-trial.mjs`
- Package alias: `ide:gate:jury-half-adder-visible-trial`
- Mapping authority: `packages/rb-apps/src/apps/ide/hardwareMappingBridge.ts`, `packages/rb-apps/src/apps/ide/projectRuntime.ts`
- Focused tests: `hardwareMappingBridge.test.ts`, `projectRuntime.fromScratchMapping.test.ts`
- Process docs: jury process, review, retrial, cockpit/current-truth/work-queue/merge-readiness docs

Out of scope:

- No Verify semantic redesign.
- No Course-check authority change.
- No sequential timing change.
- No generated VHDL/XDC/testbench/Tcl/ZIP byte change.
- No project format change.
- No Vivado/Basys3 hardware proof.
- No human review or screen-reader certification.

## Implementation Summary

The mapping fix makes `synchronizeScalarHardwareMappingV2WithProjectIoRows` create scalar entries from live boundary rows even when the canonical V2 document is empty, and preserve existing canonical pins when live rows have no replacement. `setMappingPin` now derives the current authoritative hardware state before applying a materialized pin.

The gate fix uses only visible browser workflow for the primary task and asserts final state instead of trusting hidden state shortcuts. It records metrics, screenshots, git status, dirty-worktree state, package manifest, and explicit non-claims.

## Retest Evidence

Latest hardened retrial evidence:

- Report: `.redbyte/proof/jury/2026-06-23/browser-trial/2026-06-23T14-17-07-171Z/jury-half-adder-visible-trial.json`
- Screenshot set:
  - `01-project-launch.png`
  - `02-design-complete.png`
  - `03-verify-intentional-fail.png`
  - `04-verify-repaired-pass.png`
  - `05-verify-stale-after-design-edit.png`
  - `06-verify-post-stale-rerun-pass.png`
  - `07-verify-pass.png`
  - `08-hardware-mapped.png`
  - `09-verify-post-map-pass.png`
  - `10-export-inspected.png`
  - `11-project-back-forward.png`
- Export package manifest: `.redbyte/proof/jury/2026-06-23/browser-trial/2026-06-23T14-17-07-171Z/downloaded-package/zip-manifest.json`
- Downloaded package: `.redbyte/proof/jury/2026-06-23/browser-trial/2026-06-23T14-17-07-171Z/downloaded-package/rb-blank-qqag8r-vivado-project.zip`
- Package SHA-256: `fc7f908bc0439f26dc2ebd0c495e11a42849c26b3dafa7c14114d968ee58c996`

Result:

- Trial status: `READY_FOR_JURY_DELIBERATION`
- Browser problems: `0`
- Issues recorded by gate: `0`
- Map Pins rows: passed row-to-board linking for `A -> SW0`, `B -> SW1`, `SUM -> LD0`, `CARRY -> LD1`
- Export package: manifest inspection passed for `top.vhd`, `top.xdc`, `testbench.vhd`, `vivado_import.tcl`, and `README.txt`
- XDC evidence: `V17`, `V16`, `U16`, `E19`, and at least four `LVCMOS33` constraints present

## Metric Comparison

| Metric | Hardened retrial |
|---|---:|
| Elapsed | `21448ms` |
| Clicks | `75` |
| Scrolls | `0` |
| Backtracks | `2` |
| First component | `1375ms` |
| Circuit complete | `7615ms` |
| Testbench authored | `14510ms` |
| First Compare | `14516ms` |
| First PASS | `16892ms` |

The first invalid run is not used as a success baseline because it allowed stale/blocked states. The useful comparison is proof quality: the hardened retrial now fails closed on stale Verify, incomplete Map Pins rows, blocked Export, missing downloaded package evidence, and missing non-claim metadata.

## Remaining Jury Work

Before any non-draft decision, run and document:

- Course/My check safety trial
- Sequential timing trial
- Recovery/multi-tab/dirty update trial
- Import safety trial
- Agentic accessibility/keyboard/200% zoom trial
- Human professor/student walkthrough
- Actual human assistive-technology session

## Recommendation

The primary from-scratch browser workflow is strong enough to continue jury review. PR #78 remains draft and is not ready to mark non-draft until the secondary trials and human review artifacts close.

## Non-Claims

- No human review was performed.
- No human screen-reader certification was performed.
- No Vivado synthesis, implementation, bitstream generation, board programming, or Basys3 physical observation proof was performed.
