# RedByte ECE141 Course Edition Preflight Report

Date: 2026-05-11

## Scope

This report records the initial repository safety pass for the course-edition triage branch. It is audit-only: no product code was changed during preflight.

## Branch and Worktree

| Item | Result |
| --- | --- |
| Starting branch | `main` |
| Working branch created | `chore/course-edition-repo-triage` |
| Remote | `origin git@github.com:swaggyp52/redbyte-ui-genesis.git` |
| Initial status | `main...origin/main [ahead 1]` plus untracked `.redbyte/pi-session-room/` |
| Current generated local artifacts | `.redbyte/course-edition/` browser audit artifacts, not intended for commit |

The untracked `.redbyte/pi-session-room/` tree appears to be local Marcus/session-room work and was not staged or modified.

## Tool Versions

| Tool | Result |
| --- | --- |
| Node.js | `v20.19.0` |
| npm | `10.8.2` |
| pnpm | `10.24.0` |
| Playwright | `1.58.1` |

Package manager authority is pnpm. `package.json` declares `packageManager: pnpm@10.24.0` and `engines.node >=20.19.0`. `docs/ai-usage-rules.md` also says not to run `npm install`.

## Lockfiles

| File | Status |
| --- | --- |
| `pnpm-lock.yaml` | Present and matches current workspace. `pnpm install --frozen-lockfile` passed. |
| `package-lock.json` | Present but stale/conflicting. It identifies the root as `redbyte-ui` version `2.0.1` and does not match the current pnpm workspace shape. Do not delete without approval, but it should not remain in the final student course package. |
| `yarn.lock` | Not detected during preflight. |

## Commands Run

| Command | Result | Notes |
| --- | --- | --- |
| `git status --short --branch` | Passed | Initial state was `main...origin/main [ahead 1]` with untracked `.redbyte/pi-session-room/`. |
| `git branch --show-current` | Passed | Reported `main` before branch creation. |
| `git log --oneline -n 10` | Passed | Top commit was `cdaaf53d infra(marcus): log homebase v1 deploy`. |
| `node --version` | Passed | `v20.19.0`. |
| `npm --version` | Passed | `10.8.2`; observed only, not used for install. |
| `pnpm --version` | Passed | `10.24.0`. |
| `git switch -c chore/course-edition-repo-triage` | Passed | Created the requested working branch. |
| `pnpm install --frozen-lockfile` | Passed | Completed in about 3 seconds; lockfile was current. |
| `pnpm start:smoke` | Passed | Launcher served `http://127.0.0.1:5197/` and returned HTTP 200. |
| Playwright browser audit against dev server | Passed with findings | Six surfaces loaded; starter workflow exposed repeated console warnings from `circuitStore.ts`. Details in `04-runtime-and-browser-audit.md`. |

## Package Scripts Observed

Important scripts from `package.json`:

| Script | Purpose |
| --- | --- |
| `start`, `dev`, `start:smoke`, `preview` | Local app launch and smoke startup. |
| `build`, `build:unified`, `build:unified:ci` | Production build paths; `AI_STATE.md` notes a Windows `dist` lock caveat for unified build. |
| `test`, `test:unit`, `test:run`, `coverage` | Vitest unit and coverage runs. |
| `verify:gates`, `verify:gates:classroom` | Main regression and classroom signoff gate stack. |
| `ide:gate:screenshots`, `rb:site:start:test`, `rb:ide:starter-load:gate`, `rb:ide:roundtrip:gate` | IDE visual/startup/starter/roundtrip gates. |
| `rb:vivado:bench`, `rb:vivado:certify`, `rb:bench:evidence:*` | Vivado/Basys3 bench evidence tooling. |
| `rb:doc:validate`, `rb:encoding:check` | Documentation and encoding validation. |

## Authority Documents

These documents currently read as authoritative for course-edition triage:

| Path | Why it is authoritative |
| --- | --- |
| `AI_STATE.md` | Required repo memory and current state. It records E3 as the current proof gap and notes Marcus is not an IDE surface. |
| `docs/ai-usage-rules.md` | Workflow rules: terminal-first, pnpm only, update AI_STATE for meaningful changes, remote operations disallowed in this environment. |
| `docs/legal-attribution.md` | Attribution authority: reference Connor Angiel only. |
| `docs/ACTIVE_WORK.md` | Active product cockpit for the six-surface RedByte IDE and current RC1 blockers. |
| `docs/product/RED_BYTE_CURRENT_TRUTH.md` | Compact current-state truth and non-overclaim boundaries. |
| `docs/manuals/RedByte_Product_Manual.md` | Canonical current product manual. |
| `docs/contracts/RedByte_Product_Contract.md` | Target-state product contract; useful but not proof that all target behavior is finished. |
| `docs/IDE_SYSTEM_MAP.md` | Surface ownership and runtime authority map. |
| `docs/ide/SURFACE_CONFORMANCE.md` | Governance for product surface changes and proof obligations. |
| `docs/STUDENT_RELEASE_READINESS.md` | Course readiness and evidence-tier status. |
| `docs/release/vivado-basys3-certification-matrix.md` | Row-specific Basys3/Vivado evidence matrix and E2/E3 separation. |
| `docs/release/redbyte-bench-evidence-model.md` | E0/E1/E2/E3 evidence definitions. |
| `README.md` | Public entry point aligned to the six-surface IDE and bounded Vivado handoff claim. |

## Stale, Conflicting, or Aspirational Documents

These should not be handed to students or professors as final course truth without review:

| Path or group | Finding |
| --- | --- |
| `docs/DOC_INDEX.md` stale-zone entries | Already labels OS-era docs and older workflow docs as stale. This should become the cleanup authority for archiving. |
| `docs/00-canon/00-*` through `docs/00-canon/08-*` | Mixed historical/OS-era canon. Default agent context says to exclude stale OS-era docs unless explicitly cleaning legacy behavior. |
| Root docs such as `PRODUCT.md`, `REDBYTE_USER_MANUAL.md`, `INSTRUCTOR_GUIDE.md`, `CLASSROOM_QUICKSTART_STUDENTS.md`, `CLASSROOM_QUICKSTART_INSTRUCTORS.md`, `LAB_SPECS.md` | Some still mention old launcher, OS, Studio, or pre-course-product framing. Treat as archive/rewrite candidates. |
| `docs/IMPLEMENTATION_STATUS.md`, `docs/INTERACTION_CONTRACT.md`, `docs/PRODUCT_SURFACES.md`, `docs/PROJECT_MODEL.md`, `docs/STUDENT_WORKFLOW.md`, `docs/P*_SMOKE_CHECKLIST.md` | Listed or detected as stale relative to current six-surface IDE truth. |
| `docs/product/RED_BYTE_CURATED_LEARNING_PATH_SPEC.md` | Useful but partly target/spec language; proof table needs reconciliation against current browser/tests before course publication. |
| Marcus/local-agent docs | Useful maintainer infrastructure, but not course product surface. Must be excluded from student package. |

## Risks Before Cleanup

| Risk | Evidence | Course impact |
| --- | --- | --- |
| Tracked secret/privacy surface | `.env` is tracked. A redacted inspection found `VITE_PUBLIC_DEMO` and other redacted lines. | Requires security review before public/course release. |
| Tracked generated output | `git ls-files coverage` reports many tracked coverage files; `artifacts/` includes build outputs and a classroom RC zip. | Bloats final repo and blurs source vs release artifact boundary. |
| Conflicting lockfile | `package-lock.json` coexists with pnpm lockfile and disagrees with current package metadata. | Students or future TAs may run npm accidentally. |
| Stale docs are believable | Root manuals and OS-era docs still exist next to current product docs. | Students/professor can follow the wrong workflow. |
| E3 proof remains row-specific/open | `AI_STATE.md`, `docs/ACTIVE_WORK.md`, and certification matrix keep E3 separate from E2. | Course docs must not claim automatic board behavior proof. |
| Lab 8 and advanced sequential work are not turnkey | `docs/ACTIVE_WORK.md` and readiness docs fence Lab 8/SSD/hierarchical/bus work. | Needs visible course limitations. |
| Marcus/agent tooling is mixed into repo | `.claude/`, `08 Agents + Prompts/`, Marcus scripts/docs, and untracked `.redbyte/pi-session-room/` are present. | Helpful for maintainers but should not be student-facing. |
