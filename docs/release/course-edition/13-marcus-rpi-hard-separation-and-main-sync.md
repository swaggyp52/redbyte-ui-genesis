# Marcus/RPI Hard Separation and Main Sync

Date: 2026-05-11

Scope: user-authorized final repo-boundary pass to move tracked Marcus, Raspberry Pi, HQ, Ollama, Obsidian memory, and local-agent/control-loop work out of RedByte and into `C:\MarcusRPI`, then sync the cleaned RedByte `main` to `origin/main` without force-push.

## Preflight

| Item | Result |
|------|--------|
| RedByte repo | `C:\Users\conno\redbyte-ui` |
| Current branch | `main` |
| Starting local `main` | `aebc908fd250be3359bd640035a0bc67c5128896` |
| Starting `origin/main` | `aebc908fd250be3359bd640035a0bc67c5128896` |
| Working tree before separation | Clean |
| Safety branch | `backup/pre-marcus-rpi-hard-separation` |
| One-time remote authorization | User explicitly authorized fetch/pull `--ff-only`/push `origin main`; force-push remains disallowed. |
| MarcusRPI path | `C:\MarcusRPI` |

## Classification

| Path | Tracked? | Category | RedByte Course Product Needed? | MarcusRPI Destination | RedByte Action | Risk | Notes |
|------|----------|----------|--------------------------------|------------------------|----------------|------|-------|
| `.redbyte/agent/**` | Yes | local-agent templates/prompts | No | `imports/redbyte-tracked-marcus-rpi-hq-migration-20260511-1631/.redbyte/agent/**` | Copy then `git rm` | Low after copy | Local agent configuration/examples are not part of the ECE141 IDE/course package. |
| `.github/copilot-instructions.md`, `.github/instructions/agent-tools.instructions.md`, `.github/prompts/redbyte-*.prompt.md` | Yes | local-agent/Copilot operating prompts | No | Preserved under same relative paths | Copy then `git rm` | Low | Development-agent workflow material moved with MarcusRPI. |
| `scripts/marcus/**` | Yes | Marcus | No | Preserved under same relative paths | Copy then `git rm` | Low after package cleanup | Removed alongside package scripts that invoked these files. |
| `scripts/rb-marcus-*`, `scripts/rb-hq-server*`, `scripts/rb-local-agent.mjs` | Yes | Marcus/HQ/local-agent | No | Preserved under same relative paths | Copy then `git rm` | Low after package cleanup | Removed active `rb:marcus:*`, `rb:hq:*`, and `rb:agent:*` script entries. |
| `scripts/rb-obsidian-memory*`, `scripts/rb-control-loop*`, `scripts/rb-product-feedback*`, `scripts/rb-work-driver.mjs`, `scripts/rb-session-*`, `scripts/rb-hooks/stop-reminder.mjs` | Yes | Ollama/Obsidian/local-agent control tooling | No | Preserved under same relative paths | Copy then `git rm` | Medium | These were adjacent local-agent control tools and referenced removed memory/session commands. |
| `docs/product/RED_BYTE_AGENT_*`, `RED_BYTE_MARCUS_*`, `RED_BYTE_HQ_LOCAL_AGENT.md`, `RED_BYTE_LOCAL_AGENT_LAB.md`, `RED_BYTE_OLLAMA_LOCAL_SETUP.md`, `RED_BYTE_OBSIDIAN_*`, `RED_BYTE_OPERATING_LOOP.md`, `RED_BYTE_PRODUCT_FEEDBACK_LOOP.md`, `RED_BYTE_PRODUCT_PROBLEM_INTAKE.md`, `RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md`, `RED_BYTE_WORK_DRIVER.md` | Yes | Marcus/HQ/Ollama/Obsidian/local-agent docs | No | Preserved under same relative paths | Copy then `git rm`; remove Doc Index entries | Medium | These are not student/professor course product docs. |
| `packages/rb-apps/src/apps/ide/surfaces/HqSurface.tsx`, `surfaces/hq/**`, `hqSurface.workstation.test.tsx`, `rb-work-driver.test.ts` | Yes | HQ/local-agent UI/tests | No | Preserved under same relative paths | Copy then `git rm`; remove HQ CSS | Medium | The six course IDE surfaces remain Project, Design, Verify, Hardware/Map Pins, Export, Import. |
| `public/start.html`, `docs/product/RED_BYTE_PUBLIC_START_PATH.md`, `scripts/rb-public-start-page.test.mjs` | Yes | RedByte public/course start path | Yes | Not copied | Keep and edit | Low | Marcus companion copy and required snippets removed; forbidden-claim checks now reject Marcus command copy. |
| `packages/rb-fpga-bridge/boards/registry.json` | Yes | RedByte course product | Yes | Not copied | Keep | Low | FPGA board registry, not session-room registry spillover. |
| `api/server.mjs` | Yes | RedByte ops/professor-adjacent | Human decision | Not copied | Keep | Medium | Filename matched generic `server.mjs`; no direct Marcus/RPI marker. |
| `artifacts/classroom-rc-v1/os/assets/*Hq*.js*` | Yes | Tracked classroom RC artifact | Human decision | Not copied | Keep | Medium | `Hq` appears only in hashed asset names; broader artifact cleanup remains deferred. |

## MarcusRPI Preservation

Import folder:

```text
C:\MarcusRPI\imports\redbyte-tracked-marcus-rpi-hq-migration-20260511-1631
```

Manifest:

```text
C:\MarcusRPI\imports\redbyte-tracked-marcus-rpi-hq-migration-20260511-1631\MANIFEST.md
```

MarcusRPI commits created:

| Commit | Purpose |
|--------|---------|
| `b8834e1` | Initial tracked Marcus/RPI/HQ copy from RedByte |
| `6e9b101` | Related local-agent control-loop/product-feedback tooling copy |
| `5984a4e` | Work-driver test copy discovered during reference scan |

Copied RedByte-relative file count: 84 files plus the import `MANIFEST.md`.

## RedByte Removal Summary

Removed active package script families:

- `rb:session:*`
- `rb:work:*`
- `rb:agent:*`
- `rb:memory:*`
- `rb:control:*`
- `rb:problem:*`
- `rb:hq:*`
- `rb:marcus:*`

Removed RedByte tracked source/docs/tests:

- `.redbyte/agent/**`
- `.github` local-agent/Copilot prompts listed above
- Marcus/HQ/local-agent/Ollama/Obsidian docs under `docs/product/**`
- Marcus/HQ/local-agent scripts under `scripts/**`
- HQ IDE surface source/tests and CSS
- work-driver helper test that imported removed scripts

Kept RedByte product surfaces and gates:

- Project, Design, Verify, Hardware/Map Pins, Export, Import
- ECE141 starter workflow tests
- Basys3/Vivado/VHDL/XDC export source
- course-edition docs and validation logs

## Ignore Decision

`.gitignore` now ignores `.redbyte/agent/` in full, along with the earlier `.redbyte/pi-session-room/` and session-room spillover patterns. This prevents migrated local-agent state from reappearing in RedByte.

## Remaining References

Allowed/intentional:

- Course-edition separation docs mention Marcus/RPI/HQ to preserve traceability.
- Startup and left-rail tests retain negative assertions that HQ/Marcus commands must not appear in the course IDE/start page.
- `packages/rb-fpga-bridge/boards/registry.json` remains because it is FPGA board source.

Deferred/human-review:

- `api/server.mjs` is generic RedByte ops/professor-adjacent code and was not removed.
- `artifacts/classroom-rc-v1/os/assets/*Hq*.js*` are tracked artifact names with hash-like `Hq` substrings. The broader `artifacts/**` cleanup remains deferred.
- Historical docs and hardening tickets may mention Obsidian or prior agent process as history; they are not active package scripts or IDE surfaces.

## Validation

Validation is recorded in `docs/release/course-edition/08-validation-log.md`.

## Remote Sync

Remote sync was performed only after:

1. RedByte separation commit is created.
2. Product gates pass or failures are documented as pre-existing.
3. RedByte working tree is clean.
4. `git fetch origin --prune` shows no unexpected `origin/main` divergence.

Results:

| Step | Result |
|------|--------|
| RedByte hard-separation commit | `d7765d05bbdceafc26c6b39711dd9e8d5b75559d` |
| Divergence before push | `origin/main...main` = `0 1` |
| First push | `git push origin main` succeeded; no force-push used. |
| Remote note | GitHub reported the push bypassed the required `Classroom Truth Gates` status check expectation. |
| Verification after first fetch | `main` and `origin/main` both resolved to `d7765d05bbdceafc26c6b39711dd9e8d5b75559d`. A later doc-only closeout commit may advance both refs after this row. |
