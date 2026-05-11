# RedByte ECE141 Import / Export Recovery Sprint

Date: 2026-05-11

## Preflight

| Item | Result |
| --- | --- |
| Branch | `product/import-export-recovery-1` |
| Base commit | `b5e305d4f87ff600ef1a95a988611aba53d08b67` |
| Scope | Browser-prove persistence, export download, import behavior, corrupt import recovery, and stale evidence handling for the ECE141 workflow. |
| Out of scope | Repo cleanup, MarcusRPI, install scripts, manuals, Vivado artifact correctness, full typecheck cleanup, `build:unified` redirect cleanup, and merge to `main`. |
| Browser tool | Playwright Chromium via the repo Playwright config. Browser plugin skill is available, but no callable Browser runtime is exposed in this session, so regular Playwright is the executable browser loop. |
| Local artifact path | `.redbyte/product-immersion/sprint4-import-export-recovery/` |

## Baseline Validation

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | Passed | Lockfile up to date. |
| `pnpm start:smoke` | Passed | Served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | Logic Gates Verify -> Export gate. |
| `pnpm -s ide:gate:ece141-product-immersion` | Passed | Four existing ECE141 product workflows. |
| `pnpm -s ide:gate:ece141-counter-clock-export` | Passed | Counter clock/export evidence gate. |
| `pnpm -s ide:gate:ece141-map-pins-recovery` | Passed | Manual Map Pins edit and starter recovery gate. |
| `pnpm -s ide:gate:ece141-counter-compare-pass` | Passed | Counter Compare pass and E0-only Export gate. |
| `pnpm typecheck` | Failed | Known pre-existing `@redbyte/rb-lab-engine` and pulled `rb-logic-core` type-boundary drift. |

## Import Export Capability Inventory

| Capability | Current behavior | Source evidence | Browser evidence needed | Risk | Fix candidate |
| --- | --- | --- | --- | --- | --- |
| RedByte project file import | Hidden top-bar project loader accepts `.rbproj`, `.rbproj.json`, and `.json`, decodes with `decodeRBProject`, backs up current work, and loads the project. | `packages/rb-apps/src/apps/IdeApp.tsx` `handleProjectFileSelected`; `packages/rb-apps/src/export/projectFormat.ts` `decodeRBProject`. | Browser upload of valid and invalid project JSON. | If errors are only shown in the save-status text, beginners may miss the recovery path. | Add focused browser gate if the UI state is clear enough; improve copy only if needed. |
| Vivado project ZIP export | Export downloads `<slug>-vivado-project.zip` with generated Vivado project folder entries when mapping/export diagnostics are not blocking. | `ExportSurface.tsx` `handleDownloadExport('project')`; `buildVivadoProjectFolderZip`. | Playwright download and ZIP listing for Logic Gates plus Counter or Half Adder. | Students may read download success as E1/E2/E3 if wording is unclear. | Keep or tighten E0-only wording after download. |
| Vivado kit ZIP export | Export can download `redbyte-vivado-kit.zip` from current artifact list. | `ExportSurface.tsx` `handleDownloadExport('kit')` and `buildVivadoKitZip`. | Not primary for this sprint unless project ZIP is blocked. | Secondary path can confuse students if it looks equivalent to the full Vivado handoff. | Defer unless browser audit finds overclaiming. |
| Embedded RedByte manifest in exports | Export view model includes `project.rbproj.json`; ZIP import prefers it and treats it as authoritative. | `ide-export-includes-rbproj-contract.test.ts`; `zipImport.ts` `chooseManifestEntry` and `buildManifestInspection`. | Export ZIP, inspect for `project.rbproj.json`, import it back through Import. | If browser import does not surface "manifest authoritative" clearly, students may assume loose HDL/XDC is the source of truth. | UI/gate around `ide-import-zip-authority`. |
| Raw Vivado ZIP import | ZIP import selects top HDL and XDC, reconstructs supported gate-level design, and classifies ignored files. | `zipImport.ts` reconstructed path; `ide-zip-import-contract.test.ts`. | Upload known ZIP fixture or RedByte export ZIP. | Reconstructed imports may lose internal behavior or Verify evidence. | Make limitation visible; do not overclaim full restore unless manifest path is used. |
| Corrupt ZIP / unsupported upload recovery | Import catches ZIP parse errors and shows a student-facing `Could not open ZIP` callout with technical details; submission ZIP integrity has a separate error path. | `ImportSurface.tsx` `handleZipFile`; `ide-import-zip-error`, `ide-import-submission-integrity-failed`. | Upload invalid JSON/unsupported files through actual controls. | Non-ZIP project-file errors may not get the same visible recovery treatment. | Add tests and small copy/data-testid if needed. |
| Autosave/session restore | Runtime saves project snapshots and lab session metadata; root autosave banner appears only for home/blank no-circuit state. | `IdeApp.tsx` one-time boot restore, local project snapshots, and `rb-autosave-circuit` effects. | Refresh workflows for starters after Verify/mapping/export. | Previous session restore might surprise students by preserving stale evidence or route. | Browser gate should assert E0 wording and no E1/E2/E3 overclaim after refresh. |
| Stale Verify/export tracking | Export receives `dirtySinceVerify` and evidence diagnostics warn when design/testbench/mapping changed since Verify. Export package generation is still allowed when structurally valid. | `ExportSurface.tsx` `buildEvidenceDiagnostics` and handoff truth model. | Mapping edit after Verify, starter switch, refresh after export. | Stale Compare evidence could be mistaken as current if the warning is not visible. | Add a browser gate or copy fix for stale evidence if audit shows ambiguity. |

## Persistence and Refresh Findings

| Workflow | State before refresh | State after refresh | Expected? | Risk | Fix needed | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | Starter loaded, Compare passed 12/12, SW0 manually remapped from SW0/V17 to SW2/W16, Export opened. | Project restored after browser refresh; Hardware still showed SW0 -> SW2 (pin W16); Export still showed E0/E1/E2/E3 evidence rows; previous download success state was not shown. | Yes. Mapping and project state persist, while transient download state resets. | Low. The product does not silently treat a previous browser-session download as current after refresh. | None in this sprint. | `pnpm -s ide:gate:ece141-project-persistence` |
| Logic Gates stale mapping | Compare passed before a manual pin edit. | Export marked Verify as stale and kept the primary action on Verify; a secondary draft E0 download remained available. | Yes. Mapping edits invalidate trusted handoff evidence until Verify is refreshed. | Low for trust; medium support risk if students do not notice the primary Verify CTA. | No production fix selected; existing copy is honest and now gated. | Initial RED of `ide:gate:ece141-project-persistence`, then passing gate after asserting the safe stale state. |
| 2-Bit Up Counter | Starter loaded, Compare passed 14/14, clock/reset policy visible. | After refresh, Verify still showed the clock policy panel and Export still showed E0-only evidence rows. | Yes. Sequential starter state survives refresh without claiming E1/E2/E3. | Low. | None in this sprint. | `pnpm -s ide:gate:ece141-project-persistence` |

## Export Artifact Findings

| Starter | Downloaded? | Artifact type | Contents | E0 evidence? | E1/E2/E3 overclaim? | Risk | Fix needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logic Gates | Yes | Vivado project ZIP at `.redbyte/product-immersion/sprint4-import-export-recovery/downloads/logic-gates-*-vivado-project.zip` | ZIP contained `project.rbproj.json`, `README.txt`, `vivado_import.tcl`, `.xpr`, `top.vhd`, and `top.xdc`. Manifest had `kind: rb-project`, `version: 1`, and Logic Gates project name. | Yes. Export surface evidence rows state E0 is export/package evidence only. | No. E1/E2/E3 rows explicitly require external evidence and manual observation. | Low. | None in this sprint. |
| 2-Bit Up Counter | Yes | Vivado project ZIP at `.redbyte/product-immersion/sprint4-import-export-recovery/downloads/two-bit-counter-*-vivado-project.zip` | ZIP contained the same Vivado project folder structure plus `EXPECTED_IO.json`. Manifest had `kind: rb-project`, `version: 1`, and 2-Bit Up Counter project name. | Yes. | No. | Low. Vivado artifact semantic correctness is still a separate future sprint. | Defer golden VHDL/XDC/Tcl correctness to Vivado artifact sprint. |

## Import Round-Trip Findings

| Case | Supported? | Actual behavior | Risk | Fix needed | Evidence |
| --- | --- | --- | --- | --- | --- |
| RedByte-generated Vivado project ZIP with embedded manifest | Yes | Import detected `RedByte manifest`, showed the ZIP authority callout, processed the design, showed a commit preview, then replaced the active project only after explicit confirmation. | Low. Manifest path is the correct full round-trip path. | None. | `pnpm -s ide:gate:ece141-import-export-recovery` |
| Verify result after manifest import | Partially restored by design | Import restored project, vectors, circuit, and mapping, but did not restore prior Verify PASS as trusted evidence. Opening Verify after import showed no pass hero until Compare was rerun; rerun passed 12/12. | Low. This is safer than trusting imported stale evidence. | None. | `pnpm -s ide:gate:ece141-import-export-recovery` |
| Manual mapping edit through export/import | Yes | Logic Gates SW0 -> SW2/W16 mapping survived export, manifest import, and navigation back to Hardware. | Low. | None. | `pnpm -s ide:gate:ece141-import-export-recovery` |
| Raw Vivado ZIP reconstruction | Supported for structural HDL/XDC, but not the full-fidelity path | Not exercised as a round-trip because RedByte-generated ZIPs contain `project.rbproj.json` and correctly take the manifest-authoritative path. | Medium for future imports from external Vivado projects; not a blocker for RedByte export round-trip. | Defer. | Source inventory plus existing `ide:gate:zip-import-contract`. |

## Corrupt Import and Recovery Findings

| Bad input | Expected behavior | Actual behavior | Severity | Fix needed | Evidence |
| --- | --- | --- | --- | --- | --- |
| ZIP with malformed `project.rbproj.json` manifest | No crash, clear error, no project replacement, previous project intact. | Import showed `Could not open ZIP`; technical details included `No files were changed`; Hardware still showed the previously imported Logic Gates mapping after the failed upload. | P2. The recovery behavior is safe; the generic visible error copy could be more specific, but details are present. | No production fix selected. Add a future copy task if student pilots miss the details disclosure. | `pnpm -s ide:gate:ece141-import-export-recovery` |
| Invalid project JSON through top-bar loader | Not exercised in the browser gate. Source path catches decode failures and records load failure in save/status state. | Unknown from browser. | P2. | Future focused loader error UX test. | Source inspection only. |
| Unsupported file type through Import ZIP input | Not directly exposed to users because the input accepts `.zip`; source rejects non-ZIP if provided. | Not exercised. | P3. | Defer. | Source inspection only. |

## Stale Verification and Export Findings

| Workflow | Stale state tested | Actual behavior | Risk | Fix needed | Evidence |
| --- | --- | --- | --- | --- | --- |
| Mapping change after Verify | Logic Gates Compare passed, then SW0 mapping changed. | Export treated Verify as stale for trusted handoff, primary CTA returned to Verify, secondary action allowed a draft E0 project ZIP download. | Low. This is the correct trust boundary, but it is a point to watch in student pilot. | None in this sprint. | Initial RED in new persistence gate; passing assertion after aligning the gate to the product contract. |
| Refresh after export | Export download success was transient and did not remain visible after browser refresh. | Safe. | Low. | None. | `pnpm -s ide:gate:ece141-project-persistence` |
| Starter switch | Covered by existing Map Pins recovery gate. | Logic Gates manual mapping did not leak into Half Adder in prior gate. | Low. | None. | `pnpm -s ide:gate:ece141-map-pins-recovery` |
| Manifest import | Prior Verify PASS was not restored as current trusted proof; Compare had to be rerun after import. | Safe. | Low. | None. | `pnpm -s ide:gate:ece141-import-export-recovery` |

## Fix Selection

| Issue | Severity | Why course-blocking? | Fix now? | Files likely touched | Gate/test |
| --- | --- | --- | --- | --- | --- |
| No browser gate proving refresh persistence and stale evidence behavior | P1 | Students must not lose mapping state or trust stale Verify/Export state after refresh. | Yes. Added gate. | `tests/e2e/ece141-import-export-recovery.spec.ts`, `package.json` | `pnpm -s ide:gate:ece141-project-persistence` |
| No browser gate proving RedByte ZIP export/import recovery path | P1 | E0 handoff packages must be recoverable without treating imported evidence as trusted. | Yes. Added gate. | `tests/e2e/ece141-import-export-recovery.spec.ts`, `package.json` | `pnpm -s ide:gate:ece141-import-export-recovery` |
| Generic corrupt manifest visible copy | P2 | A beginner may not open technical details. Behavior is safe, but visible copy is generic. | No. The safe recovery behavior is now gated; copy refinement can follow a student pilot. | None | Future copy task if needed. |
| Raw Vivado ZIP reconstruction round-trip ambiguity | P2 | External Vivado ZIP import is not equivalent to RedByte manifest restore. | No. Current Import authority callout already distinguishes manifest from reconstruction; future sprint can audit raw Vivado reconstruction. | None | Existing `ide:gate:zip-import-contract`; future browser gate if prioritized. |
