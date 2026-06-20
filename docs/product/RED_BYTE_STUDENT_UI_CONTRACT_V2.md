---
doc_status: current
last_validated: 2026-06-20
owner: Connor Angiel
used_by_claude: true
role: Product Trust Reset v2 student-facing UI contract
---

# RedByte Student UI Contract V2

This contract applies to the Product Trust Reset v2 branch. It supersedes V1 student-surface assumptions that exposed internal proof language, raw build identifiers, generic side rails, or card-first page composition.

It does not change release proof records, diagnostics, generated artifacts, or hardware proof boundaries by itself. Product code must be changed in later commits against this contract.

## Student Product Promise

RedByte is a Basys3-first educational digital-logic workbench. A student should be able to:

1. Start or recover a project.
2. Build and edit a circuit directly.
3. Author or use a clearly defined testbench.
4. Run the circuit and inspect observed behavior.
5. Compare behavior against explicit checks.
6. Understand exactly why a check passed or failed.
7. Map circuit I/O to the Basys3 board.
8. Export and inspect a Vivado-ready package.
9. Continue into Vivado without RedByte implying Vivado or board proof already happened.

The interface must feel like an engineering tool, not a dashboard, tutorial page, or pile of status cards.

## Normal Student UI Must Not Show

- Raw Git SHA, build hash, deploy hash, or implementation build token in the normal top bar.
- E0, E1, E2, or E3 labels in normal student surfaces.
- Phrases such as `evidence tier`, `checks synced`, `gate`, `final SHA`, or similar proof-harness wording where the student is trying to complete lab work.
- Generic `HIDE`, `SHOW INFO`, or open/close side-rail controls on supported desktop classroom viewports.
- Debug boxes, state hashes, low-level logs, or internal gate data.

## Allowed Student State Language

Use plain lab language:

- Design changed
- Checks need rerun
- Checks passed
- Pin mapping complete
- Package ready
- Vivado build not run
- Board not programmed
- Package downloaded
- Fix circuit
- Edit my check

## Diagnostics Boundary

Diagnostics may show:

- full Git SHA
- runtime/build version
- internal proof tiers
- state hashes
- gate/debug data
- low-level logs

Diagnostics must be reachable through Help / About / Diagnostics or dev mode. Diagnostics must not be the default student surface.

## Layout Contract

At `1366x768` and above, students must not rearrange the shell to make a normal page usable.

The V2 surfaces are deterministic:

- Project: no side rails; identity, current action, workflow progress, and direct commands.
- Design: fixed parts palette plus canvas; selection properties in a contextual property bar.
- Verify: Testbench / Results workspace; no external Signals rail.
- Map Pins: fixed mapping table plus Basys3 board; selected details inline.
- Export: file tree, selected file preview, and package actions/status.
- Import: guided step workflow; no permanent side rail.

## Card Rule

Cards are allowed only for:

- choosing a starter or recovery source
- a discrete actionable item
- compact structured evidence that cannot be expressed as a row/table

Prefer toolbars, split workspaces, tables, lists, tabs, inline status, contextual property bars, file trees, waveform lanes, direct controls, and section dividers.

Every visible region must answer: what can the student do here?

## V2 Acceptance

A V2 student surface is not accepted until:

- the primary work object is obvious in the first viewport
- direct actions are visible before explanatory filler
- no normal student chrome exposes raw proof/build language
- no generic side rail is required for normal desktop use
- no region exists only because an old gate expected it
- screenshots at `1366x768`, `1440x900`, and `1920x1080` look materially unlike the old card/rail app
