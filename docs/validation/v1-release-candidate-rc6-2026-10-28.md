# RedByte 1.0.0-rc.6 release candidate (2026-10-28)

Status: **local candidate, awaiting owner acceptance.** Not pushed, not merged into `main`, not
deployed. The public site still serves its earlier revision and was not touched.

## Identity

| Field | Value |
| --- | --- |
| Branch | `claude/redbyte-v1-reliability` (local) |
| Git HEAD | `febe25b8292e7afd67ff9b87f3ac870689c49841` |
| Source digest | `79a2f97dac8364d8bebc547f5407d30e7a66d8812e30f46b57ec0de5858b073d` (`scripts/source-state.mjs`: apps/playground, packages, public, tools/config, scripts and root build configs; the only dirty path, `.claude/launch.json`, is outside it) |
| Package | `.redbyte/releases/redbyte-1.0.0-rc.6-win-x64.zip` |
| SHA-256 | `9559b03b99ecef86feef10824da185abc373139d31f01ca21d332de51a48e56e` (adjacent `.sha256`) |
| Size | 33,274,770 bytes; `SHA256SUMS.txt` inside lists every packaged file |
| Packaging | reproducible (`package-candidate.mjs` packages twice and compares) |
| Runtime | bundled Node 20.19.0; `Start-RedByte.cmd` serves `http://127.0.0.1:5188/os/` |
| Build label | `build.json` `env: "dev"` means "not a production deployment" (`merge-dist.mjs`); the bundle is a production Vite build |

## Reproduce

```bash
git checkout febe25b8292e7afd67ff9b87f3ac870689c49841   # clean tree
corepack pnpm install --frozen-lockfile                 # Node 20.19.0 (.nvmrc)
RB_CANDIDATE_VERSION=1.0.0-rc.6 corepack pnpm build:unified   # empties apps/playground/dist first
node scripts/package-candidate.mjs 1.0.0-rc.6           # prints sha256 and sourceDigest
```

The printed `sourceDigest` must equal the one above; the launcher refuses a package whose
`candidate.json` and build disagree.

## Qualification (HEAD 643570212, then the test-only type fix febe25b82)

| Gate | Result |
| --- | --- |
| vitest IDE (`packages/rb-apps/src/apps/ide`) | 303 files, 2169 passed, 1 skipped |
| vitest rest of rb-apps | 230 files (+1 skipped), 1852 passed, 3 skipped |
| rb-logic-core / rb-studio / rb-studio-kernel / rb-utils / rb-fpga-proof-core / rb-logic-view | 531 / 52 / 33 / 24 (+2 skipped) / 32 / 85 passed; crash-guard 1 passed |
| Typecheck baseline | +0 in every scope (repo 139, identical shape) after febe25b82; 643570212 was +2 in two new tests, fixed |
| `verify:gates` | exit 0 (febe25b82) |
| `build:unified` | exit 0 |
| GHDL-required suites | `REDBYTE_REQUIRE_GHDL=1`: matrix, HDL import product path, import-mode feasibility |

Browser proof on the running rc.6 package (bundled runtime, port 5188):

- `scripts/release/verify-candidate.mjs`: **23/23 journeys pass**, including the new
  `responsive-theme-sweep` (4 viewports x light/dark x 16/24 px text x 5 stages) and
  `meridian-workflows`.
- Counter-proof gate plus 14 classroom journeys (`durable-navigation`, `student-counter-session`,
  `studio-accessibility`, `large-experiment`, ...): **15/15 pass**.
- `ide-meridian-counter-slice`: **134/134 checks pass**.

Evidence tier: E0 (browser and GHDL). No Vivado synthesis (E1), bitstream, programming or board
(E2/E3) claim is made for this candidate.

## Changes since rc.5 (55ee9ea5e)

- Design: choosing Wire, arming and completing a wire no longer move the canvas (the cue shares the
  command row); wrapped library headings no longer overlap; Show left/right panel moved into the
  status line.
- RB-DEBT-026: one export derivation for the workbench and Meridian, with an eleven-fixture parity
  test that drives the real Simulate Run.
- Imported HDL V1 decision (manual 12.2): reconstructed circuits only; anything else stays ports only
  and refused, source preserved; Mode B feasibility proven with GHDL but not offered.
- Journeys: the five rc.5 failures closed (`v1-baseline-red-classification-2026-10-28.md`, second
  pass); two new journeys join the candidate set.

## Known limits (tracked)

- RB-DEBT-029 schematic pin targets are 16 px tall at 100%; touching pins share hit area.
- RB-DEBT-030 with the inspector open at 1366/1440 the wire cue takes its own row (one canvas move
  on choosing Wire, none while wiring).
- Out of V1 and refused by name: analog simulation, MUX4 and other unsupported parts, imported HDL
  the importer cannot rebuild. Editing a shipped lab or example drops its starter checks by design.
- Meridian has no Export of its own; its rail links to the workbench Package stage.
- Three legacy JSON examples (`05_simple-cpu`, `17_traffic-light-fsm-basys3`, `18_4bit-alu-basys3`)
  are classified unverified; the V1 IDE catalogue does not offer them.

## Rollback

- Local: run `Stop-RedByte.cmd` in the rc.6 folder, then `Start-RedByte.cmd` in the previous folder on
  the same port. Projects live in the browser origin (`127.0.0.1:5188`) and survive the switch;
  export a session backup first as the quickstart advises.
- Previous candidates on disk: rc.5 `b14b8f9676e209fa6bb6f55590e3387e8cc7f79dd6fb2da824015c197dad0371`
  (gitHead 55ee9ea5e); rc.4 owner delivery `80239d91c1512c1a94861b7299a4b1fbb333a12647a353372ec34cc18d0e9deb`
  (gitHead 40f87ddf6).
- Source: every change is a local commit on `claude/redbyte-v1-reliability`; `main` and the deployed
  revision are unchanged, so no production rollback is needed.
