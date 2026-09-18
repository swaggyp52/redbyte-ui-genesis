# DECISIONS

Only decisions that shaped the code. Dates are 2026-09-18 unless noted.

**D-01 Location.** Built as a self-contained pnpm workspace under `daily-plate/` on the requester's branch because the requester was away from the desktop and asked for the build to happen in the cloud. It shares nothing with the surrounding repo (own lockfile, workspace file, tsconfig) so it can be moved to its own folder or repository without changes. Nothing outside `daily-plate/` was modified.

**D-02 Pins.** Node 24.21.0 (current 24 LTS "Krypton"); pnpm 10.24.0; TypeScript 5.9.3 (the 7.x native port is two months old and changes the toolchain); Vite 8.3.0 + @vitejs/plugin-react 6.1.1 (the plugin requires Vite 8); Vitest 4.1.11 (5.0 was two weeks old); Fastify 5.12.5; better-sqlite3 13.0.3 (bundles SQLite 3.53.4 ≥ 3.51.3); zod 4.6.5; Dexie 4.4.6; @simplewebauthn 14.0.x; @zxing/browser 0.2.1; Playwright 1.56.0 (matches the preinstalled Chromium 1194 in the build sandbox; bump freely on the desktop).

**D-03 Nutrient values are tagged, not numbers.** `{status: 'reported'|'estimated'|'less-than'|'unknown', amount?}` everywhere, including the database JSON. Totals carry a known sum, an estimate flag, an unknown count, and a separate less-than bound. There is no zero default anywhere.

**D-04 Exact decimals as strings.** A tiny BigInt-backed decimal module (no dependency) does all arithmetic; rounding happens only in display helpers.

**D-05 Client-generated ids.** Entities, food versions, recipe versions and mutation ids are UUIDs generated on the phone so offline entries can reference versions before the Pi has seen them. The server refuses ids that already belong to another user.

**D-06 Server recomputes snapshots.** The client builds a diary snapshot for immediate display, but the server rebuilds it from the stored food version and quantity on commit. The phone's numbers are a preview; the Pi's are the record.

**D-07 One SQLite transaction per mutation.** Each mutation in a batch commits independently with its own receipt, so a rejected item never hides a committed one. Conflicts are not receipted so a retry with a fresh base revision can succeed.

**D-08 Open Food Facts carbohydrate rule.** Only `carbohydrates-total` is trusted as total carbohydrate. A bare `carbohydrates` value becomes an *estimate* and the record is flagged for label confirmation, because label conventions differ by country and live verification was not possible.

**D-09 USDA basis.** Search hits are treated as per 100 g; branded liquids stated in ml are treated as per 100 ml with a visible warning. Missing nutrients are unknown, never zero.

**D-10 Double-tap window.** A pinned Add ignores repeat taps on the same shortcut for ~700 ms after the local write, covering the acknowledgement; a later tap is a real second serving.

**D-11 Meal offer threshold.** "Save this as a meal?" after the same two-or-more-food combination in the same meal slot on three separate days; dismissals are stored server-side.

**D-12 Sessions.** Cookie `dp_session`, HttpOnly, SameSite=Lax (needed for the Home Screen launch and invite redirect), Secure outside localhost, 30 days idle / 90 days absolute. CSRF defense: custom `x-daily-plate: 1` header required on every state change plus Origin allow-list.

**D-13 Service worker scope.** Precache only the built app shell; all `/api/` requests bypass the worker. Updates show a banner and apply on tap; the outbox lives in IndexedDB so a reload never loses queued work.

**D-14 Style-src 'unsafe-inline'.** Progress widths and a few sheet positions use inline `style` attributes; scripts remain `'self'` only.

**D-15 Recipe deletion hides its food.** The recipe's derived food is hidden and unpinned rather than deleted so past diary entries keep resolving.

**D-16 Playwright journey is one session.** The e2e suite shares one browser context so cookies and IndexedDB persist like on a real phone.

**D-17 One ranking module.** `rankLocalFoods` and `rankCandidates` live in `@daily-plate/domain` and are the only ranking code; the Pi's search service and the phone's Add Food call the same functions so results cannot drift.

**D-18 Database result → amount first.** A provider hit opens the portion sheet directly (identity, source note, warnings, household portions from the details call). The full label form is a secondary "Check or edit the label" action. Adding a database item also saves it as one of her foods so it is offline next time; that is the deliberate difference between saving and logging.

**D-19 Barcode order.** Phone-saved foods, then Pi-saved foods, then Open Food Facts, then a USDA branded search accepted only on exact GTIN. A scanned code no source knows travels into the label form so the next scan is local.

**D-20 Counts are never grams.** A typed count ("2 eggs") maps to the food's piece/serving unit; if none exists the amount is dropped with a visible hint rather than converted to 2 g.

**D-21 Search means search.** Enter submits an online search; the first local hit is never opened implicitly. Every online response carries the query generation that issued it and is discarded if the query changed.

**D-22 Type in rem.** All font sizes are rem so the platform's text scaling reaches the layout; rows wrap instead of clipping at 200%. Spacing stays in px.

**D-23 Test-only provider stub and seed.** `DP_PROVIDER_STUB_DIR` answers USDA/OFF from fixtures and `dev/seed.js` builds synthetic accounts; both throw under `NODE_ENV=production`, which the image sets.

**D-24 No commercial provider yet.** See DATA_SOURCES "Adding another provider". `FoodCandidate` is the extension point; nothing speculative is wired.

**D-25 Prebuilt SQLite binding.** better-sqlite3 13 ships prebuilt Node-API binaries for linux/darwin/win32 on x64 and arm64 and marks itself `gypfile: false`; pnpm is told not to compile it (`ignoredBuiltDependencies`). A fresh Windows desktop or runner needs no C++ toolchain, the Pi image loads the `linux-arm64` prebuild, and the SQLite engine gate at boot still decides whether the binary is acceptable.

**D-26 Offline shell is a Chromium-proven claim.** Playwright's WebKit build does not serve the service-worker app shell under `setOffline`, so the O01 journey asserts the offline open only in Chromium. WebKit proves the pending entry survives close/reopen and reconciles exactly once. Safari on a physical iPhone remains a home check.

**D-27 The home screen is eaten and left, stated.** Her words were "macros consumed/outstanding". Each of protein, carbs and fat shows "N g eaten" and "N g left" (or "N g over", in neutral gold, never a failure colour) with the goal beside the name; she never subtracts. Calories stay secondary and appear only when a source gave them. Cal AI was usability evidence (big numerals, visible progress, obvious date), not a design to copy: no calorie ring, no health score, no streaks, no extra tabs.

**D-28 The week is always on screen.** A seven-day strip replaces the date sheet; the selected day is filled, days with entries carry a dot, arrows step a week, and "Back to today" is one button. Large text narrows the strip to five or three days rather than crushing it.

**D-29 Rows answer "is this the one?"** A familiar-food row carries her last amount and what it adds ("1 bottle · 30 protein · 15 carbs · fat ?"); a search-result row carries name, brand/portion and protein · carbs · fat per basis. Provider names live in the portion sheet note and in food details, never in lists.
