# RedByte Product Surface System

RedByte uses one product surface contract across every major stage surface.

## Page Anatomy

Every major surface should read in the same order:

1. Command owner
2. Primary work region
3. Secondary evidence or detail region
4. Optional tertiary drawer, inspector, or advanced layer

The command owner is compact. It may be a standalone command strip or an integrated workbench header when the workspace itself owns the actions. It carries the page role, current state, and the most important workflow actions. It does not try to become a second workspace.

The primary region owns the page. It is where the student does the main job for that surface.

The secondary region supports the primary region. It is visible only when it helps the main workflow.

The tertiary layer holds deeper tools, advanced controls, and analysis that do not deserve permanent top-level weight.

## Shell Behavior

- App navigation stays global.
- Stage navigation stays stable and does not reinvent itself per surface.
- Rails are secondary by default and must earn their width.
- Pages should use available width deliberately instead of clustering important content into a narrow top-left block.
- Inspectors and drawers are secondary, not co-primary surfaces.

## CTA Hierarchy

- One primary action per surface.
- Secondary actions stay nearby but visibly subordinate.
- Advanced actions belong behind disclosure, drawers, or secondary panels.
- Primary CTA placement is consistent in the command owner unless the workspace itself owns the action, as Verify does with Run and Design now does with its workbench header.

## Status Language

Canonical status words:

- Blocked
- Ready
- Stale
- Current
- Needs review
- Checks current

Status appears first in the command owner, then in supporting detail regions only when the student needs more explanation.

## Vocabulary

Canonical product words:

- Stimulus
- Observed outputs
- Checks
- Build
- Map Pins
- Program
- Handoff
- Import

Surfaces should not reintroduce drifting synonyms when the canonical word already exists.

## Visual System Expectations

- Dark, deliberate, calm, and engineering-focused
- One panel rhythm across surfaces
- Consistent chip and badge weight
- Clear workbench-versus-evidence distinction
- Width belongs to the dominant work region, not to passive chrome

## First Sync Targets

The first shared-system application targets:

- Project as the workflow front door
- Design as the build surface
- Verify as the stimulus-and-observation surface

Hardware, Export, and Import follow after those three agree on one page grammar.
