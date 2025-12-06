# Contextual Onboarding Plan

The OS apps share a common windowed shell, so onboarding should feel consistent while highlighting the unique workflows inside Logic Designer, CPU Designer, and the viewer apps (3D World, Signal Scope, Logic Export). This plan documents the tooltips, triggers, and state we need to add later without altering runtime code yet.

## Shared patterns
- **Entry trigger:** Only show onboarding when a user opens an app for the first time (per `project.meta.id` + app ID). Persist completion state in a lightweight store (localStorage or a kernel-level preference) so windows do not re-teach the same steps mid-session.
- **Presentation:** Use a small tooltip HUD anchored to key controls with a "Next" and "Skip" CTA. Keep copy under 18 words and add a progress indicator (e.g., 1/4).
- **Accessibility:** Ensure tooltips are keyboard focusable, timeouts are avoided, and announced via `aria-live` for screen readers.

## Logic Designer tooltips
- **Palette intro:** Anchor to the left gate palette to explain that the palette is template-driven and syncs with ProjectContext; CTA: "Add your first gate".
- **Table guidance:** Highlight the gate table header to explain labels/types and that remove is destructive but reversible via history snapshots (future state).
- **Empty state reminder:** When no gates exist, point to the empty-state copy with a tooltip encouraging palette usage and describing expected gate naming.
- **Exit condition:** Complete after a user adds at least one gate or clicks "Skip". Store completion keyed by app ID and project ID.

## CPU Designer tooltips
- **Unit palette:** Point at the CPU unit list to clarify categories (ALU, register file, control, etc.) and that clock speed defaults can be edited later.
- **Roster table:** Highlight the CPU map table to describe the columns and to show that removal only affects the current project snapshot.
- **Design intent note:** Add a tooltip near the footer copy to set expectation that bus-level layout arrives later; encourage creating a minimal bill of materials now.
- **Exit condition:** Finish after adding one unit (any kind) or skipping; persist completion per project.

## Viewer apps onboarding
### 3D World
- **Run/Step controls:** Tooltip explains run/pause/step semantics and that `mappedBlocks` reflects the latest logic-to-redstone mapping.
- **Layer slider:** Highlight the layer slider to teach clamped Y navigation and how it relates to voxel slices.
- **Summary bar:** Point at the project summary text to reinforce that data comes from ProjectContext and updates live when logic changes.
- **Exit condition:** Mark complete after a layer change or run/step interaction.

### Signal Scope
- **Signal selector:** Tooltip on the select box noting that only `OUTPUT_LAMP` nodes appear and that selecting nothing auto-picks the first output.
- **Layer input:** Highlight the layer numeric input to show how probes align with voxel Y coordinates.
- **Add probe CTA:** Teach that "Add probe" pushes a new probe into the ProbeBus; mention that visibility can be toggled later (future feature).
- **Exit condition:** Complete after adding a probe or skipping.

### Logic Export
- **Mode switcher:** Tooltip on the mode select explaining JSON vs. Verilog vs. redstone listings and when each is useful.
- **Preview pane:** Highlight the textarea to note it is read-only and regenerates when project logic changes.
- **Counts banner:** Point at the node/wire counts to show export size expectations and to warn about large block lists.
- **Exit condition:** Complete after the user changes mode once or dismisses the flow.

## Implementation notes for later
- Provide a `useOnboarding(appId)` hook that returns completion state and step controls; store per-project completion in localStorage with a `rb-onboard/<projectId>/<appId>` key.
- Tooltip components should support an `anchorRef` and render inside a portal attached to the app window root to avoid clipping.
- Add event emitters for meaningful actions (gate add/remove, CPU unit add/remove, 3D layer change, probe add, export mode change) so onboarding can mark completion without coupling tightly to UI components.
