# Main Sync and Marcus/RPI Separation

Date: 2026-05-11

Scope: preserve Marcus/Raspberry Pi/local-agent spillover in `C:\MarcusRPI`, clean the RedByte working tree, and prepare RedByte course-edition work for main synchronization. This is not a RedByte product feature sprint.

## Phase 0 - Preflight and Safety Snapshot

| Item | Result |
| --- | --- |
| Current branch | `chore/course-edition-repo-triage` |
| Current HEAD before cleanup | `f4f229192bc43ef4fef2c279439785573e9166a5` |
| Local `main` HEAD | `cdaaf53d4fa29f6d35b86ff7b7eaf02110a4243b` |
| Local `origin/main` ref | `08da238d0c2227e8ed4c714377eba4d2e55ba015` |
| Local `origin/chore/course-edition-repo-triage` ref | `f4f229192bc43ef4fef2c279439785573e9166a5` |
| Remote | `origin git@github.com:swaggyp52/redbyte-ui-genesis.git` |
| Safety branch | `backup/pre-main-sync-2026-05-11` |
| Remote fetch/push policy | `AI_STATE.md` says remote operations are disallowed in this environment. Network sync commands are therefore policy-blocked unless that rule is overridden. |

Commands run:

```powershell
git status --short
git status --ignored --short
git branch --show-current
git log --oneline -n 12
git remote -v
git branch -vv
git log --oneline --decorate --graph --all -n 30
git rev-parse HEAD
git rev-parse main
git rev-parse origin/main
git rev-parse origin/chore/course-edition-repo-triage
git branch backup/pre-main-sync-2026-05-11
```

Initial status:

- Untracked: `.redbyte/pi-session-room/`
- Modified: none
- Relevant ignored local outputs: `.redbyte/agent/runs/`, `.redbyte/course-edition/`, `.redbyte/product-immersion/`, `.redbyte/session/`, `.redbyte/work/`
- Local `main` is an ancestor of `chore/course-edition-repo-triage`.
- `chore/course-edition-repo-triage` is 4 commits ahead of local `main`.
- `chore/course-edition-repo-triage` is 5 commits ahead of the local `origin/main` ref.
- Local `main` is 1 commit ahead of the local `origin/main` ref.

## Marcus/RPI/Local-Agent Classification

| Path | Tracked? | RedByte-related? | Marcus/RPI-related? | Action | Reason |
| --- | --- | --- | --- | --- | --- |
| `.redbyte/pi-session-room/**` | No | No course-product role | Yes | Move to `C:\MarcusRPI`, then remove untracked RedByte copy | Clear Raspberry Pi Marcus session-room spillover with `server.mjs`, `marcus-doctor.sh`, `rooms.json`, `registry.json`, connection profile, and plugin manifest. |
| `.redbyte/agent/**` examples/templates | Yes | Maintainer-only at most | Local-agent related | Human review required | Already tracked source-like templates and prompts. Removing them touches repo agent workflow assumptions and should be handled as a separate migration, not mixed with this local spillover cleanup. |
| `scripts/marcus/**` | Yes | Not student course workflow | Marcus/local-agent related | Human review required | Active package scripts reference these files through `rb:hq:test` and Marcus scripts; removal would require package-script and possibly test cleanup. |
| `scripts/rb-marcus-*.mjs`, `scripts/rb-hq-server*.mjs`, `scripts/rb-local-agent.mjs` | Yes | Maintainer-only at most | Marcus/HQ/local-agent related | Human review required | Package scripts and existing tests reference these; removal is larger than session artifact separation. |
| `docs/product/RED_BYTE_MARCUS_*.md`, `docs/product/RED_BYTE_OLLAMA_LOCAL_SETUP.md`, `docs/product/RED_BYTE_HQ_LOCAL_AGENT.md`, `docs/product/RED_BYTE_LOCAL_AGENT_LAB.md`, `docs/product/RED_BYTE_AGENT_*.md` | Yes | Maintainer history, not student course product | Marcus/local-agent related | Human review required | Prior course-edition inventory already classified this as maintainer-only/archive candidate. Delete/move needs coordinated doc-index cleanup. |
| `packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx` and `surfaces/hq/**` | Yes | Not one of the six course surfaces | Marcus/HQ related | Human review required | Existing startup tests reject `?mode=hq`, but source/tests still exist. Removing it is product-surface cleanup, not a safe spillover move. |
| `packages/rb-fpga-bridge/boards/registry.json` | Yes | Yes | No | Keep in RedByte | Board registry is FPGA/Basys3-adjacent source, not Marcus/RPI spillover despite matching `registry.json`. |
| `api/server.mjs` | Yes | Possible ops/professor tooling | No direct Marcus marker | Human review required | Generic ops server caught by filename pattern only. It should not be removed without deciding the professor/ops boundary. |

## C:\MarcusRPI Preparation

Actual path used:

```text
C:\MarcusRPI
```

Actions:

- Created `C:\MarcusRPI`.
- Initialized it as a standalone git repo.
- Added `C:\MarcusRPI\README.md`.
- Imported the RedByte spillover under:

```text
C:\MarcusRPI\imports\redbyte-spillover-20260511-1538\.redbyte\pi-session-room\
```

Copy verification:

- Source files copied: 9
- Target files present: 9
- Target bytes: 118528
- Search found token-related code references only; no token value file was present in the copied set.

## RedByte Cleanup Actions

Moved/copied out of RedByte:

| Source path | Destination path | Verification | RedByte action |
| --- | --- | --- | --- |
| `.redbyte/pi-session-room/**` | `C:\MarcusRPI\imports\redbyte-spillover-20260511-1538\.redbyte\pi-session-room\` | 9 files copied; `server.mjs` verified present before removal | Removed untracked RedByte copy after verified copy |

`.gitignore` decision:

Because `.redbyte/agent/**` contains intentionally tracked examples/templates, the repo should not ignore all of `.redbyte/`. Narrow ignores were added instead:

```gitignore
.redbyte/pi-session-room/
.redbyte/**/rooms.json
.redbyte/**/registry.json
.redbyte/**/connection-profile*.json
.redbyte/**/marcus-lab*.json
.redbyte/**/server.mjs
.redbyte/**/server-contract*
.redbyte/**/marcus-doctor*
```

## Tracked Marcus/HQ/Local-Agent Material Still Present

The following classes remain tracked in RedByte after this safe spillover cleanup:

- Marcus/HQ/local-agent scripts: `scripts/marcus/**`, `scripts/rb-marcus-*.mjs`, `scripts/rb-hq-server*.mjs`, `scripts/rb-local-agent.mjs`
- Agent templates/prompts: `.redbyte/agent/**`
- Marcus/Ollama/local-agent docs under `docs/product/**`
- HQ source/tests under `packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx`, `surfaces/hq/**`, and `hqSurface.workstation.test.tsx`
- Package scripts exposing `rb:agent:*`, `rb:hq:*`, and `rb:marcus:*`

Classification: human review required. These are not untracked spillover; they are committed repo content with imports, tests, package scripts, docs index references, or historical `AI_STATE.md` entries. Removing them safely needs a separate migration branch that copies the relevant source/docs into `C:\MarcusRPI`, deletes or rewrites RedByte package scripts/docs/tests, and reruns broad package gates.

## Sync Status

Local sync state before validation:

- `chore/course-edition-repo-triage` contains the course-edition audit, runtime stabilization, package-boundary cleanup, and product immersion commits.
- Local `main` is an ancestor of the course branch, so a local fast-forward or merge from `chore/course-edition-repo-triage` is structurally possible.
- Network sync to `origin/main` is policy-blocked by the current `AI_STATE.md` remote-operation rule unless explicitly overridden.
