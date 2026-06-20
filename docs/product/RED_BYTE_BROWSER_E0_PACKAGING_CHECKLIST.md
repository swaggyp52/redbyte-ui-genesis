---
doc_status: current
last_validated: 2026-06-20
owner: Connor Angiel
used_by_claude: true
role: browser E0 packaging readiness checklist and no-overclaim boundary
---

# RedByte Browser E0 Packaging Checklist

This checklist defines the packaging-readiness boundary for the browser E0 app. Browser E0 means the classroom workflow is proven in a browser build: Project, Design, Verify, Hardware mapping, Export handoff, Import recovery, route continuity, build identity, and error-free first-viewport behavior.

Browser E0 does not mean Vivado proof. It does not prove Vivado synthesis, implementation, bitstream generation, Basys3 programming, Basys3 behavior, physical board observation, or any E1-E3 external hardware result.

## Current Proof Tier

- Current tier: Browser E0 only.
- Node proof: Node 20.19.0 is available through the repo-local portable runtime under ignored `.redbyte/tools/node-v20.19.0/`.
- Local release subset: `Classroom Truth Gates`, release gates, build, docs validation, encoding check, and diff check must pass under Node 20.19.0 when practical.
- Final SHA discipline: the local final build must show the final commit short hash, and the deployed SHA must match the final pushed commit before closeout.
- Deployed targets: `https://redbyteapps.dev/os/` and `https://redbyte-ui-genesis.pages.dev/os/`.

## Release Checklist

- Confirm `main` is clean, synced with `origin/main`, and GitHub is green before work.
- Rebuild the app from the final source under Node 20.19.0 when practical.
- Run `ide:gate:release-final-sha-discipline` after the worktree is clean.
- Run `ide:gate:browser-e0-packaging-readiness`, `ide:gate:release-candidate-decision`, `classroom:gate`, `build:unified`, `rb:doc:validate`, `rb:encoding:check`, and `git diff --check`.
- Push only after local validation passes.
- Verify GitHub `Classroom Truth Gates`, `Deploy to Cloudflare Pages`, and `Cloudflare Pages` are green for the final commit.
- Verify deployed `/os/version.json` or `/os/build.json` reports the final SHA on `redbyteapps.dev` and `redbyte-ui-genesis.pages.dev`.

## Browser E0 Demo Checklist

- Project first launch shows project identity, title rename, direct starts, and non-blocking Flow help.
- Loaded Project shows current next action, Design, Verify, Map Pins, Export, Build Fresh, Course Starter, Import/Recover, Open Recent, and compact evidence without card-heavy metrics.
- Design supports starter and blank authoring paths without cropped controls or root overflow.
- Verify supports observe-only, Compare PASS, intentional FAIL, repair, PASS, and readable evidence at supported viewports.
- Hardware mapping shows Basys3 resources and pin consequences as browser E0 mapping evidence only.
- Export handoff exposes package contents, checklist, download path, and no E1-E3 overclaim.
- Import recovery exposes source selection, review, apply boundary, and unsupported-example recovery without implying imported hardware proof.
- Navigation, reload, and browser Back/Forward preserve mode continuity.
- Browser console/page errors, dynamic-import failures, workspace error boundaries, and root horizontal overflow are stop-ship issues.

## Packaging Blockers

- Final-current local build smoke and deployed SHA proof must be collected for the exact final commit.
- Remaining Project/Verify visual maturity must continue to be judged from live browser screenshots, not stale docs.
- Browser E0 proof still needs release notes, support handoff, demo script, and teacher/student quickstart polish before unsupervised classroom packaging.
- Any app-shell issue that breaks first launch, reload, version metadata, or deployed build identity blocks packaging.

## Hardware Blockers

- Vivado 2024.2 or an explicitly selected supported Vivado version must be available.
- `xsct`, `hw_server`, and Xilinx/Vivado environment setup must be present.
- A Basys3/Digilent/Xilinx-like USB device must be physically available.
- E1 requires real Vivado build evidence from the generated handoff.
- E2 requires programming/bitstream proof.
- E3 requires physical Basys3 observation evidence.

## Commercial Or Licensed Delivery Blockers

- Commercial, paid, or licensed delivery requires legal/licensing review, attribution review, distribution packaging, support ownership, privacy/security posture, classroom onboarding/support docs, and operational incident handling.
- Browser E0 proof alone is not a commercial-readiness claim.
- Do not advertise paid classroom readiness until the commercial checklist is explicitly closed.

## Exact No-Overclaim Language

Do not claim hardware proof from Browser E0 evidence.

Use this wording in release notes, demos, and closeouts:

> RedByte is currently proven as a Browser E0 classroom workflow. This proof does not claim Vivado synthesis, bitstream generation, Basys3 programming, Basys3 behavior, or E1-E3 external hardware results.
