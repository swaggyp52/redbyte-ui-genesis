# RedByte ECE141 Course Edition Final Package Boundary

Date: 2026-05-11

## Final Course Product: In Scope

The final public/course-facing GitHub repo should contain:

| Area | Paths or examples |
| --- | --- |
| RedByte app source | `packages/rb-apps/src/apps/IdeApp.tsx`, `packages/rb-apps/src/apps/ide/**`, supporting package code. |
| Current IDE surfaces | Project, Design, Verify, Map Pins/Hardware, Export, Import. |
| Logic/runtime packages | `packages/rb-logic-*`, `packages/rb-primitives`, `packages/rb-utils`, `packages/rb-theme`, `packages/rb-tokens`, and required runtime support. |
| Basys3 and Vivado handoff | Basys3 board assets, VHDL generation, XDC generation, Vivado Tcl generation, export bundle/project snapshot support. |
| Course examples/starters | Curated ECE141 examples and official lab starters after each is labeled as supported, bridge-only, or experimental. |
| Tests and QA gates | Vitest tests, Playwright/e2e tests, IDE screenshot gates, starter-load gates, roundtrip gates, Vivado/export certification gates. |
| Windows launch path | `Start-RedByte.ps1`, `run.bat`, and later bounded student `install.ps1`, `launch.ps1`, `doctor.ps1`, `update.ps1`, `clean-reset.ps1`. |
| Course docs | Student quick start, professor guide, evidence guide, Vivado handoff guide, Basys3 mapping guide, troubleshooting/reset guide, known limitations. |
| Maintainer truth docs | `AI_STATE.md`, `docs/ACTIVE_WORK.md`, current truth, product manual, product contract, system map, release checklists, certification matrix. |
| CI and package metadata | `package.json`, `pnpm-lock.yaml`, workspace/config files, CI config, lint/test/build configs. |
| Intentional static assets | Assets used by the app or intentionally referenced by docs/QA. |

## Development-Only: Allowed But Not Shipped

These can exist in the engineering repo if clearly labeled and excluded from student packages:

| Area | Boundary |
| --- | --- |
| Marcus/HQ/local-agent workflows | Maintainer-only. Not an IDE surface and not part of student workflow. |
| Agent prompts, skills, local MCP experiments | Keep private/local or clearly marked development-only. |
| Full release evidence logs | Keep concise proof docs in repo; move bulky raw logs/screenshots/build products to release artifacts. |
| Hardware bridge experiments | Maintainer QA only unless later promoted through product contract and course docs. |
| Business/planning vaults | Not part of public course source unless converted into maintained docs. |

## Archive: Not Final Product

Move or preserve through branch/tag/archive before removal:

| Area | Archive reason |
| --- | --- |
| OS-era docs and old product surface docs | They conflict with the six-surface IDE and current manual. |
| Root legacy manuals/quick starts | Useful language may be salvaged, but current versions compete with canonical docs. |
| Historical redesign/spec/planning dumps | Not maintained course truth. |
| Old playground experiments | Not official RedByte Course Edition product unless directly required by app host. |
| Agent/Marcus history and vault material | Useful for maintainers, not for course-facing repo. |

## Remove or Gitignore

After approval, remove from git or keep ignored:

| Path or pattern | Action |
| --- | --- |
| `coverage/**` | Remove tracked coverage output; keep ignored. |
| `dist/**`, `out/**`, `playwright-report/**`, `test-results/**`, `node_modules/**` | Keep ignored and out of git. |
| `.redbyte/course-edition/**` | Ignore local audit/browser artifacts. |
| `.redbyte/bench/runs/**`, `.redbyte/work/**`, `.redbyte/session/**` | Keep ignored; publish only curated evidence summaries. |
| `package-lock.json` | Remove or archive after approval; pnpm is authoritative. |
| Release zips/build outputs under `artifacts/**` | Move to GitHub Release artifacts or external archive, except intentionally small docs/fixtures. |
| `.env` | Security review, rotate if needed, replace with `.env.example`, remove tracked secret-bearing file. |

## Needs Human Decision

| Area | Decision needed |
| --- | --- |
| Marcus/HQ/agent material | Keep in public repo as maintainer tooling, move to private repo, or archive branch only? |
| `artifacts/**` proof files | Which screenshots/logs are intentional proof docs vs generated output? |
| `labs/**`, `samples/**`, `test-submission/**` | Which files are official starters, fixtures, submissions, or answer leakage? |
| `api/**`, `ops/**`, `services/**`, `packages/ops*` | Are these required for professor administration or only future/local operations? |
| Root legacy docs | Rewrite into course docs first, then archive originals? |
| `.env` history | Is rotation/history cleanup required before public release? |

## Proposed Final Top-Level Structure

```text
.
|-- apps/
|-- packages/
|-- scripts/
|   |-- course/
|   |-- vivado/
|   `-- qa/
|-- examples/
|-- docs/
|   |-- student/
|   |-- professor/
|   |-- release/
|   |-- manuals/
|   |-- contracts/
|   `-- ide/
|-- tests/
|-- tools/
|-- public/
|-- Start-RedByte.ps1
|-- run.bat
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
`-- README.md
```

Development-only folders may remain in the engineering repo if clearly documented, but the distributed course zip should be generated from a manifest that excludes archived/generated/private material.

## Proposed `.gitignore` Updates

Add:

```gitignore
.redbyte/course-edition/
```

Review after approval:

```gitignore
.env
artifacts/**/*.zip
artifacts/**/dist/
artifacts/**/assets/
```

Do not add those broader ignores until the tracked artifact and `.env` cleanup plan is approved, because current tracked files need deliberate removal and traceability.

## Branch, Tag, and Archive Strategy

1. Before deletion, create a preservation point from the current messy source state:
   - Tag option: `archive/pre-course-cleanup-2026-05-11`
   - Branch option: `archive/pre-course-cleanup`
2. Land this triage branch with inventories and no mass deletion.
3. Open separate small cleanup PRs:
   - generated output cleanup,
   - stale docs quarantine,
   - environment/security cleanup,
   - course docs rewrite,
   - student package manifest.
4. Keep large release zips/build outputs in GitHub Releases or external archive, not in `main`.
5. Treat the final student distribution as a generated course bundle from the clean source repo, not as a raw clone of every maintainer file.
