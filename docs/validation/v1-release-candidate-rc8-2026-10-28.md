# RedByte 1.0.0-rc.8 release candidate (2026-10-28)

Status: **local candidate, recommended for owner acceptance** (decision document:
`v1-owner-acceptance-dossier-2026-10-28.md`). Not pushed, not merged into `main`, not deployed;
redbyteapps.dev still serves `57c8a94` (built 2026-07-27). rc.8 supersedes rc.7: acceptance testing
of the rc.7 package found six release blockers (B1-B6 below). rc.8 fixes those and changes nothing
else. rc.7 is kept unchanged as the rollback reference.

## Identity

| Field | Value |
| --- | --- |
| Branch | `claude/redbyte-v1-reliability` (local) |
| Git HEAD | `bc5ec62ebbc6485b9be1e132874a512be48b07e2` |
| Source digest | `990bb8bbf3a470fc4dcac8e191d102ee6956218d964d1dbbcd0da1e4fd99e8a6` (`scripts/source-state.mjs`; the only dirty path at packaging, `.claude/launch.json`, is outside it) |
| Package | `.redbyte/releases/redbyte-1.0.0-rc.8-win-x64.zip` |
| SHA-256 | `82e179deb31b860ae337cadf6fd262017251d9ccf9e19072d6b676494bc12d8b` (adjacent `.sha256`) |
| Size | 33,016,832 bytes; 158 files plus `SHA256SUMS.txt`, every one verified in the packaged folder (`package-inspection.json`) and after a clean extraction |
| Against rc.7 | adds `THIRD_PARTY_NOTICES.txt`, removes `app/os/wallpaper.jpg`; launcher, server, Start/Stop scripts, Node runtime and LICENSE byte-identical |
| Packaging | reproducible (`package-candidate.mjs` packages twice and compares) |
| Runtime | bundled Node 20.19.0; `Start-RedByte.cmd` serves `http://127.0.0.1:5188/os/` |

## Reproduce

```bash
git checkout bc5ec62ebbc6485b9be1e132874a512be48b07e2   # clean tree
corepack pnpm install --frozen-lockfile                 # Node 20.19.0 (.nvmrc)
RB_CANDIDATE_VERSION=1.0.0-rc.8 corepack pnpm build:unified
node scripts/package-candidate.mjs 1.0.0-rc.8           # prints sha256 and sourceDigest
```

## Blockers fixed since rc.7 (`b0d16cad7`)

Each was reproduced on the rc.7 package first; each regression is red on rc.7.

| # | rc.7 defect | rc.8 | Regression |
| --- | --- | --- | --- |
| B1 | With the inspector open at 1440x900 and 1366x768, the Wire badge and Cancel took a second command row that came and went with every wire (a finished wire returns to Select), moving the canvas 44 px on every arm and finish (RB-DEBT-030) | the whole Wire cue (badge, message, Cancel, and More for a cut refusal) lives in the status line; the command row never holds a tool's cue (`a29573231`) | `design-workspace-stability` journey section 1 (no pin or row moves over three wires at both sizes); rc.7 fails it at "choosing Wire moves no pin"; `designSurface.authoringIssues` unit test |
| B2 | No notices for the bundled libraries and fonts | `THIRD_PARTY_NOTICES.txt` (22 packages with their licence texts), generated from the build's source maps by `scripts/release/third-party-notices.mjs` (`f9eb1d34f`) | `ui:license-audit-gate` runs `--check` (it was an `echo` since 2026-03-01) |
| B3 | Unlicensed fan-art `wallpaper.jpg` in every candidate | removed from `public/` (the deletion is in `a29573231`, staged earlier and swept into that commit; history not rewritten) | absent from the package listing |
| B4 | "Vivado-ready" (landing page), "Synthesizable top-level VHDL" (Package file note), "Synthesizable Verilog Export / Requires: rb_primitives.v" (Design Verilog preview) | "for AMD Vivado"; "Generated top-level VHDL; synthesis runs in Vivado, outside RedByte"; "Verilog preview: read-only, not part of the Vivado package…" (`f9eb1d34f`) | text search of the rc.8 bundle: none of the three phrases (`package-inspection.json`) |
| B5 | QUICKSTART: logs in `.logs` (the launcher writes `run/`); rc.4 rebuild steps | corrected; names the notice files (`f9eb1d34f`) | QUICKSTART in the package read |
| B6 | Workbench dark drew part names near-white on the light sheet (1.14:1) | schematic ink follows the sheet's own appearance (`a29573231`) | `design-workspace-stability` section 3: every part name at least 4.5:1 (rc.8 lowest 14.35:1); rc.7 fails |

The product manual was corrected in `9cc2ac081` (part number, the Vivado `.xpr` procedure, no
instructor tools in 1.0, the multi-file import exception, no synthesis or tamper claims, tick
semantics, the bundled server). `bc5ec62eb` repairs the legend-contrast test's CSS parser, which the
B6 selector list broke (below).

## Qualification

Evidence: `.redbyte/releases/redbyte-1.0.0-rc.8-evidence/` (`qual/summary.txt` and one log per
gate, with `qualify.sh` and `ghdl.txt`; `qual-delta/`; `verify-candidate/`; `journeys/`;
`meridian-slice.log`; `acceptance/`; `browser-proof-summary.txt`).

Full run on `9cc2ac081`, Node 20.19.0, `REDBYTE_GHDL` = GHDL 6.0.0 and `REDBYTE_REQUIRE_GHDL=1`
exported for every gate:

| Gate | Result |
| --- | --- |
| vitest IDE | **2 failed**, 2173 passed, 1 skipped: `boardInstrument.legendContrast` read the schematic token blocks with regexes that required the root selector to be followed by `{`; B6 gave both blocks a selector list, so both themes parsed as empty and the test failed before measuring. Runtime board tokens are unchanged (no `--rb-board-*` token is redeclared inside the Design workspace). Fixed in `bc5ec62eb` (passes on the rc.7 and rc.8 stylesheets; a light label ink of `#c4ccd8` fails it at 1.49:1) |
| vitest rest of rb-apps | 230 files (+1 skipped), 1852 passed, 3 skipped |
| rb-logic-core / rb-studio / rb-studio-kernel / rb-utils / rb-fpga-proof-core | 531 / 53 / 33 / 24 (+2 skipped) / 32 passed |
| nine other included packages | 32 files, 252 passed, 1 skipped |
| rb-logic-view (+ crash-guard on its own) | 85 (+1) passed |
| `apps/**` | no test files |
| Typecheck baseline | +0 in every scope (repo 138) |
| `verify:gates` | exit 0 (467 s), including the licence gate now checking the shipped notices |
| `build:unified` | exit 0 |

Delta run on `bc5ec62eb` (one test file changed): vitest IDE 304 files, 2175 passed, 1 skipped;
typecheck +0 in every scope.

GHDL: every GHDL suite ran (its skips are the three GHDL-present placeholders and fixture). A
negative control with `REDBYTE_REQUIRE_GHDL=1` and a missing GHDL fails eight suites (47 tests) but
four suites (`testbench.ghdl-execution`, `register-config-authority.agreement`,
`hdl-export.fail-closed`, `vivado-e1-harness`) skip instead, adding 16 skips
(`qual-delta/ghdl-negative-control.log`; RB-DEBT-032). A GHDL-less run would therefore show
as more skips, not as failures; rc.8's skip counts match the GHDL-present pattern.

## Browser proof on the rc.8 package

`browser-proof-summary.txt`, `probes/summary.txt`; bundled runtime throughout.

- Clean extraction (scratch folder; `clean-run.cmd`: `PATH=C:\Windows\System32;C:\Windows`, no Node
  or development variables, run from the user's home folder; fresh profiles): 158/158 files verified;
  no request outside `127.0.0.1`, no console or page errors (`acceptance/deps-probe.log`); lifecycle
  stop/start, reopen, crash recovery and stale lock as designed (`acceptance/lifecycle.json`); the
  owner walkthrough, 27 steps, no page errors; its downloaded package passes GHDL 6.0.0 (4/4) and an
  AND→OR mutant fails it (`acceptance/ghdl-check/result.json`); gallery 20 states.
- Packaged folder on port 5188 (rc.7 stopped there first): `scripts/release/verify-candidate.mjs`
  **24/24 pass** (12 min; `sourceUnchanged: true`; the served build reports 1.0.0-rc.8 at `bc5ec62eb`);
  counter-proof gate and 14 classroom journeys **15/15 pass**; `ide-meridian-counter-slice`
  **134/134**; Meridian lenses with Q1 selected at t3 keep one selection through Time, Logic, Source
  and Board (`acceptance/lenses/`).
- Wiring, rc.7 against rc.8 (`probes/wire-narrow-*.json`, part selected; choose Wire, arm, refuse,
  Esc): rc.7 moves the target pin 44 px at 1440x900 and 1366x768; rc.8 moves nothing at 1440, 1366,
  1280 and 1024 px. With 150% text the status line grows 5 px while armed at 1280x650 (rc.8) and
  1024x640 (both) without moving a pin. At 720x450 the Design workspace scrolls in both (RB-DEBT-031).
- The 16 journeys no release run includes (informational): 8 pass; 8 fail identically on rc.7 and
  are stale (removed surfaces, a disclosure, a changed table; RB-DEBT-034).
- rc.7 and rc.8 re-verified after all testing: both ZIPs match their checksums; every file matches
  its `SHA256SUMS.txt` (`rc7-reverify.json`, `package-inspection.json`).

Evidence tier: E0 (browser and GHDL). No Vivado synthesis (E1), bitstream, programming or board
(E2/E3) claim is made for this candidate.

## Corrections to the rc.7 report and records

- RB-DEBT-030 was recorded as "one 22 px move when Wire is chosen; none while wiring". With the
  inspector open at 1366/1440 the row came and went with every wire, moving the canvas on every arm
  and finish (44 px). Fixed in rc.8.
- "Every included directory green" held; but `REDBYTE_REQUIRE_GHDL=1` was not recorded in any log
  (now `qual/qualify.sh` and `qual/ghdl.txt`), and it does not cover four suites (above).
- rc.7's evidence folder also holds `qual/`, an earlier run on `d9e6d6865`; the rc.7 report cites
  `qual-final/` on `b0d16cad7`, which is the candidate's.
- The manual and README described behaviour the code does not have (now corrected in the manual;
  README and linked docs listed in the dossier, section 6).

## Known limits (tracked)

- RB-DEBT-029 pin targets are small; RB-DEBT-031 the status line wraps in a narrow window with
  enlarged text; RB-DEBT-032 the GHDL require guard misses four suites; RB-DEBT-033 the acceptance
  findings V3-V14 (dossier section 4).
- Out of V1 and refused by name: analog simulation, MUX4 and other unsupported parts, single-file
  imported HDL the importer cannot rebuild. A ZIP import with several VHDL files and a matching XDC
  ships its original source unverified (manual 12.2; owner decision D5).
- Meridian is reachable only through `?studio=meridian` and has no Export of its own.
- The generated README still says "deterministic synthesizable VHDL top module" (changing it moves
  golden hashes; owner decision D8).
- Distribution decisions before any copy is handed out: the LICENSE grant (D1) and the course
  naming consent (D3); see the dossier.

## Rollback

- Local: `Stop-RedByte.cmd` in the rc.8 folder, then `Start-RedByte.cmd` in the rc.7 folder on the
  same port. rc.8 changes no storage code, so projects in the browser origin carry over; export a
  session backup first as the quickstart advises.
- Previous candidates on disk, unchanged: rc.7 `300294d5c7a5954b125cf9cad6b2b3ca386d66945a20c48f31eca12ce9a5cbcb`
  (gitHead b0d16cad7), rc.6 `9559b03b99ecef86feef10824da185abc373139d31f01ca21d332de51a48e56e`
  (gitHead febe25b82), rc.5 `b14b8f9676e209fa6bb6f55590e3387e8cc7f79dd6fb2da824015c197dad0371`,
  rc.4 owner delivery `80239d91c1512c1a94861b7299a4b1fbb333a12647a353372ec34cc18d0e9deb`.
- Source: every change is a local commit on `claude/redbyte-v1-reliability`; `main` and the
  deployed revision are unchanged, so no production rollback is needed.
