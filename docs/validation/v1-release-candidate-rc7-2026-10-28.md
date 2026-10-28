# RedByte 1.0.0-rc.7 release candidate (2026-10-28)

Status: **local candidate, awaiting owner acceptance.** Not pushed, not merged into `main`, not
deployed. The public site still serves its earlier revision and was not touched. rc.7 supersedes
rc.6: an adversarial review of rc.6 and a fix-verification round found real defects that every
rc.6 gate had passed (`v1-baseline-red-classification-2026-10-28.md`, third pass).

## Identity

| Field | Value |
| --- | --- |
| Branch | `claude/redbyte-v1-reliability` (local) |
| Git HEAD | `b0d16cad7224dc48e19334faa2723830f625dbf3` |
| Source digest | `0192223e44917d9fb21a662aa6ac1661da4b77f7b29834b1750a854127cb3946` (`scripts/source-state.mjs`; the dirty paths at packaging, `.claude/launch.json` and docs, are outside it) |
| Package | `.redbyte/releases/redbyte-1.0.0-rc.7-win-x64.zip` |
| SHA-256 | `300294d5c7a5954b125cf9cad6b2b3ca386d66945a20c48f31eca12ce9a5cbcb` (adjacent `.sha256`) |
| Size | 33,277,570 bytes; `SHA256SUMS.txt` inside lists every packaged file |
| Packaging | reproducible (`package-candidate.mjs` packages twice and compares) |
| Runtime | bundled Node 20.19.0; `Start-RedByte.cmd` serves `http://127.0.0.1:5188/os/` |
| Build label | `build.json` `env: "dev"` means "not a production deployment" (`merge-dist.mjs`); the bundle is a production Vite build |

## Reproduce

```bash
git checkout b0d16cad7224dc48e19334faa2723830f625dbf3   # clean tree
corepack pnpm install --frozen-lockfile                 # Node 20.19.0 (.nvmrc)
RB_CANDIDATE_VERSION=1.0.0-rc.7 corepack pnpm build:unified   # empties apps/playground/dist first
node scripts/package-candidate.mjs 1.0.0-rc.7           # prints sha256 and sourceDigest
```

## Qualification on `b0d16cad7`

Evidence is kept beside the package, outside the session:
`.redbyte/releases/redbyte-1.0.0-rc.7-evidence/` (`qual-final/summary.txt` and one log per gate;
`verify-candidate/results.json`; `journeys/`; `meridian-slice.log`; `browser-proof.txt`).

| Gate | Result |
| --- | --- |
| vitest IDE (`packages/rb-apps/src/apps/ide`) | 304 files, 2175 passed, 1 skipped |
| vitest rest of rb-apps | 230 files (+1 skipped), 1852 passed, 3 skipped |
| rb-logic-core / rb-studio / rb-studio-kernel / rb-utils / rb-fpga-proof-core / rb-logic-view (+ crash-guard) | 531 / 53 / 33 / 24 (+2 skipped) / 32 / 85 (+1) passed |
| The nine other packages the root config includes (rb-lab-engine, rb-fpga-toolchain, rb-bridge-agent, rb-fpga-bridge-contract, rb-fpga-signing, rb-logic-adapter, rb-primitives, rb-theme, rb-viewport) | 32 files, 252 passed, 1 skipped (not run for rc.6) |
| `apps/**` | no test files |
| Typecheck baseline | +0 in every scope (repo 138: the deleted obsolete test's diagnostic left; re-recorded in d9e6d6865) |
| `verify:gates` | exit 0 (446 s) |
| `build:unified` | exit 0 |
| GHDL-required suites | `REDBYTE_REQUIRE_GHDL=1` set for every chunk |

Browser proof on the running rc.7 package (bundled runtime, port 5188):

- `scripts/release/verify-candidate.mjs`: **23/23 journeys pass** (784 s; `sourceUnchanged: true`),
  including the strengthened `design-core-authoring` (guidance and the longest refusal read in full,
  status-line height unchanged), `meridian-workflows` (every drawn value compared; 8 instance-wire
  values by hand) and `responsive-theme-sweep` (80 configurations plus the status line at 720x450
  with 32 px text).
- Counter-proof gate plus 14 classroom journeys (`durable-navigation`, `student-counter-session`,
  `studio-accessibility`, `large-experiment`, ...): **15/15 pass** (11 of them are also among the 23).
- `ide-meridian-counter-slice`: **134/134 checks pass**.
- Red on rc.6 (same journeys, rc.6 package): `design-core-authoring` (guidance 13 of 230 px, not
  announced) and `responsive-theme-sweep` (status-line overlap at 720x450, 32 px text).

Evidence tier: E0 (browser and GHDL). No Vivado synthesis (E1), bitstream, programming or board
(E2/E3) claim is made for this candidate.

## Changes since rc.6 (`febe25b82`)

- **Design, Wire tool**: what to do next and why a click was refused are said in the status line's
  announced hint slot (rc.6 left the message 13 px of 230 at 1280x650, unannounced); a long refusal
  takes a second line inside the line's own height; a repeated refusal is announced again; the cue
  keeps one size when a wire is armed.
- **Status line**: it wraps one control at a time instead of drawing Show left panel over Hide
  bottom panel (720x450 at 200% text) or leaving the bar (480 and 375 px); focus rings are no
  longer clipped; hiding any panel hands keyboard focus to the control that reveals it.
- **Meridian**: wires leaving a module instance carry the value recorded inside it (the
  hierarchical adder's carries were drawn blank) via `moduleInstanceOutputSources`.
- **Tests and journeys**: the parity test reads IdeApp's own autosaved export and states each
  fixture's truth by hand; the import feasibility test no longer accepts any refusal; the sweep
  waits for painted stage text, fails at 4.5:1 and checks the status line; journeys compare every
  drawn Meridian value, read the longest refusal in full and name the failed output.
- **Obsolete test** `apps/toolchain-route.test.tsx` deleted (its subject was removed in 9f31efe95
  and 677559527).

## Corrections to the rc.6 report

- "vitest all green" covered rb-apps and six packages only; nine packages (32 files) were not run.
  They pass at rc.7.
- "choosing Wire, arming and completing a wire no longer move the canvas" held at 1280x650 only;
  with the inspector open at 1366/1440 choosing Wire still moves it once (RB-DEBT-030).
- The parity test's "eleven fixtures" were ten plus a source scan, and its line comparing the two
  derivation entry points compared a function with itself.

## Known limits (tracked)

- RB-DEBT-029 schematic pin targets are 16 px tall at 100%; touching pins share hit area.
- RB-DEBT-030 with the inspector open at 1366/1440 the Wire badge and Cancel take their own row
  (one canvas move on choosing Wire, none while wiring); at 720x450 with 150% text a refusal that
  needs three lines shows two with an ellipsis (whole text in its title and announcement).
- RB-DEBT-031 in a narrow window with enlarged text the status line wraps, and a change in what it
  holds can change the workspace height by one line.
- About 80 fixed sleeps that predate rc.5 remain in three long journeys outside the reads the review
  named; they fail safe.
- Out of V1 and refused by name: analog simulation, MUX4 and other unsupported parts, imported HDL
  the importer cannot rebuild. Editing a shipped lab or example drops its starter checks by design.
- Meridian has no Export of its own; its rail links to the workbench Package stage.
- Three legacy JSON examples (`05_simple-cpu`, `17_traffic-light-fsm-basys3`, `18_4bit-alu-basys3`)
  are classified unverified; the V1 IDE catalogue does not offer them.

## Rollback

- Local: run `Stop-RedByte.cmd` in the rc.7 folder, then `Start-RedByte.cmd` in the previous folder on
  the same port. Projects live in the browser origin (`127.0.0.1:5188`) and survive the switch;
  export a session backup first as the quickstart advises.
- Previous candidates on disk: rc.6 `9559b03b99ecef86feef10824da185abc373139d31f01ca21d332de51a48e56e`
  (gitHead febe25b82); rc.5 `b14b8f9676e209fa6bb6f55590e3387e8cc7f79dd6fb2da824015c197dad0371`
  (gitHead 55ee9ea5e); rc.4 owner delivery `80239d91c1512c1a94861b7299a4b1fbb333a12647a353372ec34cc18d0e9deb`
  (gitHead 40f87ddf6).
- Source: every change is a local commit on `claude/redbyte-v1-reliability`; `main` and the deployed
  revision are unchanged, so no production rollback is needed.
