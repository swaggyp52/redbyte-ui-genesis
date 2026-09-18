# TEST_EVIDENCE

Environment for every row: Anthropic cloud sandbox, Linux x86_64, Node v24.21.0, pnpm 10.24.0, Chromium 1194 via Playwright 1.56.0. Date 2026-09-18. Commit: see the PR head (each row reproduced at the final commit unless noted). Nothing below was run on a Raspberry Pi or a physical iPhone.

## Commands and results

| # | Command (from `daily-plate/`) | Result |
|---|---|---|
| E1 | `pnpm verify` (build packages → typecheck all → build server → `pnpm test` → build web) | domain 42/42, contracts 5/5, server 41/41, web 7/7; typecheck clean; web build 161 KB gzip main chunk, 117 KB gzip lazy scanner chunk; 29 s |
| E2 | `pnpm --filter @daily-plate/web run test:e2e` (real server serving the built app, iPhone-14 viewport Chromium) | 10/10 journeys passed; screenshots in `docs/screens/01..14` |
| E3 | Real process: `node dist/cli.js version`, `invite`, `node dist/main.js`, curl redeem → bootstrap, `cli.js backup` | sqlite 3.53.4 ≥ 3.51.3; invite redeemed over HTTP; presets 140/130/45 and 145/165/40 returned; backup verify `ok: true` |
| E4 | `pnpm --filter @daily-plate/server --prod deploy --legacy <dir>` then run it with `DP_WEB_DIST` | 106 packages, 66 MB; healthz 200, `/` 200, `sw.js` 200 with `cache-control: no-cache`, manifest 200, `/foods` SPA fallback 200, anonymous `/api/v1/bootstrap` 401, CSP header present |
| E5 | `pnpm audit --prod` | No known vulnerabilities found |
| E6 | `grep -rlE "tskey-\|DP_USDA_API_KEY\|api_key=" apps/web/dist/assets/` | no matches |
| E7 | `docker info` | daemon unavailable → image build **BLOCKED** here |
| E8 | `curl https://api.nal.usda.gov/... ` and `https://world.openfoodfacts.org/...` | egress denied (CONNECT 403) → live provider checks **BLOCKED** here |

## Second pass (cloud completion campaign), commit 37f6ba7 unless noted

| # | Command (from `daily-plate/`) | Result |
|---|---|---|
| E9 | `pnpm verify` at 48ac49b and 37f6ba7 | domain 48, contracts 5, server 49, web 11 (113 total); typecheck clean; builds clean; web main chunk 163 KB gzip, scanner chunk lazy |
| E10 | `pnpm --filter @daily-plate/web exec playwright test --project=iphone-chromium` | 23/23: 10 original journeys (`journeys.spec.ts`), 9 catalog/repeat-use journeys against fixture-backed providers (`catalog.spec.ts`), 4 lived-in journeys on a 100-day seeded account incl. 200% text (`lived-in.spec.ts`); axe WCAG 2.2 AA on every screen; screenshots `docs/screens/20..32` |
| E11 | `node dist/benchmark/run.js --mode replay` | Harness runs all 80 cases through the real search service against fixtures; report states **NOT MEASURED** for live coverage. Replay found plausible results only where fixtures exist (basic 4/15); this is a harness check, not a coverage figure |
| E12 | `ops/export-source.sh` then `ops/cleanroom-test.sh` (unrelated temp dir) | Archive `daily-plate-src-37f6ba7.tar.gz`, 210 files, sha256 `865f938ca5d7b71d57e8d20217b6ad4b30ad7a374ac24faca7c72f415b6bd630`, no node_modules/dist/db/.env. Clean room: frozen install, `pnpm verify` (113 tests), production build, real server smoke (healthz, shell, anonymous 401) → PASS in 33 s. First attempt found and fixed a real defect (verify typechecked the web app before the server's declaration output existed) |
| E13 | `ops/preflight-config.sh ops/.env.example` | Read-only; correctly FAILS on placeholder RP ID and auth key, warns on missing paths/USDA key, nothing written |
| E14 | `.github/workflows/daily-plate-cloud.yml` | Ran on this PR; final run at ed8cceb all six jobs PASS (see "Workflow results") |
| E15 | Live USDA / Open Food Facts calls | **BLOCKED**: egress denied (CONNECT 403) in this environment; no authentic captures exist yet |

### Workflow results
Final run of the cloud completion pass: [35391414542](https://github.com/swaggyp52/redbyte-ui-genesis/actions/runs/35391414542) at ed8cceb (GitHub-hosted runners). Every job green.

| Job | Runner | Result |
|---|---|---|
| Verify (x64, Node 24) | ubuntu-24.04 | **PASS**: frozen install, `pnpm verify` (typecheck, 113 unit/integration tests, builds), `pnpm audit --prod`, source archive + checksums uploaded |
| Journeys (iphone-chromium) | ubuntu-24.04 | **PASS**: all journeys (mother journeys incl. passkey via virtual authenticator, catalog/repeat-use, lived-in incl. 200% text), axe scans included |
| Journeys (iphone-webkit) | ubuntu-24.04 | **PASS**: same journeys on Playwright's WebKit (passkey journey skipped by design; offline shell asserted in Chromium only, D-26). WebKit is Playwright's engine, not Safari |
| Container (x64) | ubuntu-24.04 | **PASS**: native image build; non-root read-only boot; `sqlite 3.53.4`; invite → entry → restart → entry recovered; backup `ok: true`; scratch restore `ok: true`; anonymous bootstrap 401; image identity recorded |
| Container (arm64) | ubuntu-24.04-arm (native ARM64) | **PASS** with the same steps. A hosted ARM runner is not the Pi: no Pi resource figures come from this |
| Windows source install + unit tests | windows-latest | **PASS**: frozen install (prebuilt SQLite binding, D-25), package builds, server build, typecheck, domain/contracts/server tests, web build |

Getting there took four fixes, each a real portability defect found by the runners and kept in the code: the SQLite binding was compiled instead of using the shipped prebuild (Windows has no C++ toolchain by default); the Windows job typechecked the web app before the server's declarations existed; a POSIX-only file-mode assertion; and Vite on Windows searching past the workspace root for a PostCSS config and finding the host repository's Tailwind one. Two WebKit-only failures were real product bugs too: the offline app shell (D-26) and two toasts stacked on one spot hiding each other (now a column).

## Third pass (simplicity convergence), head recorded in the final report

| ID | Command / check | Result |
|---|---|---|
| E16 | `pnpm --filter @daily-plate/web exec playwright test --project=iphone-chromium e2e/simplicity.spec.ts` | 11/11 on the 100-day seeded account. A: the first screen (iPhone 14 size, no scrolling) contains the day, the date, Rest/Training, protein/carbs/fat each with eaten and left, fiber/sugar, and Add Food; no source names on the home screen. Task lengths measured as deliberate interactions: B pinned food = 1; C recent food ≤ 3; D unfamiliar food ≤ 4 (search, pick, amount, add); E change an amount ≤ 3; F switch Rest/Training = 1 with eaten unchanged and the page not reflowing; G repeat yesterday's meal ≤ 4. Over a goal reads "12 g over" in neutral words. Offline add says "Waiting to save". 200%: no sideways scroll, figures stay on one line, controls reachable |
| E17 | Full Chromium suite after the redesign | 34/34 (10 mother journeys, 9 catalog, 4 lived-in, 11 simplicity); every axe scan clean after the muted-ink contrast fix (`--ink-mute` 5.4:1 on white) |
| E18 | `pnpm verify` after the redesign | typecheck, 113 unit/integration tests, builds: PASS |

Fresh evidence screenshots from the actual implementation on seeded synthetic data (`docs/screens/40–48`): 40 Today typical day (viewport and full page), 41 Today at 200%, 42 Today with two goals exceeded, 43 Add Food start, 44 search results, 45 portion sheet, 46 saved-meal preview, 47 offline pending, 48 My Foods.

## Acceptance matrix

| ID | Scenario | Status | Where |
|---|---|---|---|
| N01 | Rest / training preset; 165 g confirmed at setup | PASS | `goals.test.ts`, `core.test.ts` N01, e2e step 1 (setup shows the interpretation, values editable) |
| N02 | Shake at 1.5 servings → 45/22.5/7.5, fat and sugar unknown | PASS | `nutrients.test.ts`, `core.test.ts` N02 (server-materialized snapshot, survives restart), e2e step 2 (preview text and Today rows) |
| N03 | Two confirmed containers; unknown sugar retained | PASS (synthetic) | `quantities.test.ts`, `providers.test.ts` N03 — real product **not verified** |
| N04 | Zero vs missing vs less-than | PASS | `nutrients.test.ts`, `display.test.ts`, contracts reject less-than 0 |
| N05 | Per-serving vs per-100 basis | PASS | `quantities.test.ts`, `providers.test.ts` (USDA per-100 g/ml, OFF per-serving) |
| N06 | Mass vs volume; cooked vs raw | PASS | `quantities.test.ts` density-required errors; preparation preserved from USDA descriptions |
| N07 | Total carbs / sugar semantics | PASS | `providers.test.ts` (bare OFF carbs → estimate + label confirmation; fiber never added; sugar never added into carbs) |
| N08 | Label update leaves the past entry unchanged | PASS | `core.test.ts` N08 |
| N09 | Recipe yield change creates a new version | PASS | `recipes.test.ts`, `core.test.ts` recipe test |
| N10 | Precision and rounding | PASS | `decimal.test.ts` (no accumulated error over 100 additions; rounding at display only) |
| N11 | Daily totals missing a nutrient are provisional | PASS | `nutrients.test.ts`, `goals.test.ts`, e2e "1 item missing fat" + provisional note |
| U01 | Pinned favorite: one deliberate add, explicit portion, acknowledgement, Undo | PASS | e2e step 5 |
| U02 | Accidental double-tap vs real second serving | PASS | e2e step 5 (dblclick adds once; later tap adds again) |
| U03 | Search ambiguity → choice, not a hidden guess | PASS | e2e journeys step 6; catalog spec (generic banana over snacks, stale query discarded, database result → amount sheet, multiple barcode matches ask); `ranking.test.ts` (vanilla ≠ chocolate, raw ≠ cooked, zero-sugar) |
| U04 | Camera denied / no match | PASS (manual path) | catalog spec: manual digits offline → saved food; unknown code → label form with the code kept → local on next scan; camera-permission prompt itself is a physical-device check |
| U05 | Edit / remove / move / Undo without duplicates | PASS | `core.test.ts` U05, e2e step 3 |
| U06 | Training override affects the selected day only; default change keeps history | PASS | `core.test.ts` U06, e2e step 4 |
| U07 | Larger text / narrow width / VoiceOver | PARTIAL | type in rem; lived-in spec at 200% root font size: no horizontal overflow on Today/Add Food/sheet, primary actions reachable; axe on every screen; VoiceOver **BLOCKED** (physical device) |
| U08 | Keyboard and safe areas | PARTIAL | safe-area insets and scrolling sheets implemented; iOS keyboard behaviour **BLOCKED** |
| U09 | Unknown item captured as a draft and resolved later | PASS | `core.test.ts` U09, e2e step 6 |
| O01 | Offline add, close, reopen | PASS | `sync.test.ts` O01 (real server via inject), e2e step 7 (context offline → page closed → reopened → reconciled, 4 entries not 5) |
| O02 | Lost server response then retry → one entry, same receipt | PASS | `core.test.ts` O02, `sync.test.ts` O02 |
| O03 | Server unavailable → no false acknowledgement | PASS | `sync.test.ts` (state offline, entry pending), e2e "On this phone — waiting to save" |
| O04 | Offline edits/deletes and conflicts | PASS | `sync.test.ts` conflict tests (attention item; keep mine / keep the Pi's) |
| O05 | Day boundary / timezone / DST | PASS | `dates.test.ts`; entries store local date + IANA zone |
| O06 | Logout / expired / revoked session | PASS | `auth.test.ts`, `sync.test.ts` (pending kept, other account refused), e2e step 10 (pending work survives lock and syncs after unlock) |
| O07 | App update with pending queue | PARTIAL | outbox in IndexedDB survives reload (e2e reload step); update banner never forces reload; stale-PWA-vs-new-server **BLOCKED** (needs two builds on a device) |
| O08 | Storage quota failure | PARTIAL | persistence requested and reported honestly in Settings; a write failure surfaces as an error toast; quota exhaustion not simulated |
| P01 | Provider timeout / 429 / schema mismatch | PASS | `providers.test.ts` (timeout, 429 Retry-After, malformed hits, ECONNRESET → unavailable, local foods still work) |
| P02 | Source attribution / normalization fixtures | PARTIAL | `usda-2`: search vs detail shapes, numbers vs ids, per 100 g vs per 100 ml, label-per-serving scaling, household portions (0.5 cup → cup), GTIN equality; OFF carbohydrate flag; **authentic captures BLOCKED** |
| S01 | Unauthenticated requests | PASS | `auth.test.ts` |
| S02 | Synthetic second user | PASS | `core.test.ts` S02 |
| S03 | Invite preview / replay / passkey challenges | PASS | `auth.test.ts`, e2e step 1 (peek after redeem invalid) |
| S04 | CSRF / text injection / arbitrary URL | PASS | `core.test.ts` CSRF, `providers.test.ts` allow-list; React escapes rendered names |
| S05 | Logs / bundle / images | PASS | E5, E6; log redaction configured |
| D01 | Wrong-architecture build prevention | BLOCKED | Dockerfile builds native modules per platform; not built here |
| D02 | App restart | PASS | `core.test.ts` N02 restart half; `backup.test.ts` |
| D03 | Backup and isolated restore | PASS | `backup.test.ts` (snapshot during WAL, integrity, counts, scratch restore excludes later writes), E3 |
| D04 | Release / rollback | BLOCKED | runbook only |
| D05 | Existing projects unchanged | BLOCKED | preflight/diff scripts only |
| D06 | Public cellular access after approval | BLOCKED | approval not requested; serve.funnel.json prepared |
| D07 | Physical iPhone installation | BLOCKED | virtual-authenticator passkey ceremony passed in Chromium (e2e step 10) |
| D08 | Resource budget | PARTIAL | bundle within budget; Pi memory/CPU **BLOCKED** |

| A-01 | Paging, details, household portions | PASS (fixtures) | `providers.test.ts` paging/details; catalog spec "More results", "2 eggs" → large |
| A-02 | Local barcode independence | PASS | `providers.test.ts` (Pi-local skips providers); catalog spec (phone-local while offline) |
| A-03 | Catalog coverage measured | NOT MEASURED | E11; live run needs a connected machine |
| B-01 | Database pick without label detour; meal from search; add-another; copy yesterday | PASS | catalog spec |
| C-01 | WebKit journeys, containers x64/arm64, Windows smoke | PASS | Workflow results (ed8cceb) |
| D-01 | Clean-room extraction | PASS | E12 |
| S-01 | Today answers eaten/left for protein, carbs, fat without scrolling; Rest/Training obvious; Add Food unmistakable | PASS | E16 |
| S-02 | Familiar foods are dramatically faster than first-time foods (1 tap pinned, ≤3 recent, ≤4 unfamiliar) | PASS | E16 |
| S-03 | 200% text on Today: no overlap, no sideways scroll, figures readable | PASS | E16, E10 |

## Honest gaps
- No Pi, no Docker daemon, no provider egress, no physical iPhone, no WebKit in this environment. WebKit and containers are delegated to the committed workflow; everything else marked BLOCKED needs the desktop or the Pi.
- Chromium's virtual authenticator proves the passkey ceremony wiring, not Safari or iOS passkey behaviour; the passkey journey is skipped on WebKit by design and says so.
- The Samuel Adams Octoberfest product was not verified; the app offers the manual label path.
- Screenshots are from Chromium emulating an iPhone 14 viewport, not from Safari.
