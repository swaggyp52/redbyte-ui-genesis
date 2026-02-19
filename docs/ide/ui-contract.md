# RedByte IDE UI Contract (Pixel Spec v1)

Status: Canonical
Scope: `IdeApp` default route (`/`)

## 1) Layout Grid (Hard Contract)

1. Main content uses a 12-column grid inside a bounded container.
2. Max content width is 1280px (allowed range 1200-1320px).
3. Left rail width is fixed at 72px.
4. Right inspector width is fixed at 320px desktop, stacked on narrow viewports.
5. The main panel and inspector align to a shared top edge.
6. Global shell dimensions are fixed:
   - top bar: 56px
   - left rail: 72px
   - mode header row: 48px
   - status bar: 32px

## 2) Spacing Rhythm (8px Only)

Allowed spacing tokens:

1. 4
2. 8
3. 12
4. 16
5. 24
6. 32
7. 40
8. 48

No random spacing values for layout or panel padding.

## 3) Page Rhythm (All Modes)

Every mode must render this order:

1. Title row (48px visual block)
2. Action row (primary CTA + secondary actions)
3. Workspace/body region (fills remaining height)
4. Right inspector (always present, can be minimal)

## 4) Typography Contract

1. Page title: 20-22px
2. Section heading: 14-16px semibold
3. Body text: 13-14px
4. Secondary/meta text: 12px
5. Body line-height: 1.35-1.5

## 5) Color and Emphasis

Three surface levels are required:

1. Base app background
2. Panel background
3. Raised panel background

Semantic statuses required:

1. Success
2. Warning
3. Error
4. Info

Primary actions use one accent family only.

## 6) State Contract (All Modes)

Each mode must define and render:

1. Empty state with one primary CTA
2. Loading state (skeletons preferred)
3. Error state (actionable)
4. Blocked state (explicit fix path)

## 7) Mode Wireframes (ASCII)

Project:

```text
| Title Row: Project Overview                           [Ready/Blocked] |
| Action Row: [Open Design] [Import HDL]                              |
| Main: Summary Cards + Readiness + Artifact Table | Inspector         |
```

Design:

```text
| Title Row: Design Workspace                           [Canvas Ready]  |
| Action Row: [Select] [Wire] [Delete] [Zoom]                        |
| Main: Palette + Canvas Empty/Graph                 | Inspector       |
```

Verify:

```text
| Title Row: Verification                               [PASS/FAIL]     |
| Action Row: [Run Verification] [Open Vectors]                      |
| Main: Result Banner + Diff Table + Callouts         | Inspector      |
```

Export:

```text
| Title Row: Export                                     [READY/BLOCKED] |
| Action Row: [Download Bundle] [Open IO Mapping]                    |
| Main: Artifact Tree + Previews                      | Inspector      |
```

Import:

```text
| Title Row: Import                                     [Ready/Pending] |
| Action Row: [Create RBProject] [Reset Input]                        |
| Main: HDL/XDC Tabs + Parsed Ports + Preview         | Inspector      |
```

## 8) Acceptance Checklist

1. No full-screen empty voids in any mode.
2. Left rail, title row, and right inspector are present in every mode.
3. Every mode has either a primary CTA or explicit blocked message.
4. Layout remains readable at 1366x768 and 1920x1080.
5. Markers remain deterministic for gates (`data-testid` and mode markers).
