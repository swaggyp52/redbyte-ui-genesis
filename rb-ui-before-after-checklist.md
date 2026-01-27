# RedByte UI Cohesion Pass - Before/After Checklist

## Before
- Icons were mixed (emoji + custom SVGs) with inconsistent sizing.
- No unified top bar or determinism status surface.
- System Log existed only indirectly; events were easy to miss.
- Terminal felt like a demo with limited OS integration.
- Settings lacked theme modes, density control, and motion control.
- Toast dismiss could leave a lingering hitbox.
- Window chrome lacked explicit provenance cues.

## After
- IconMap registry enforced (semantic names, 16/20/24 sizes).
- Top bar shows determinism mode, REC state, tick, log entry point.
- System Log app is first-class and shows append-only events.
- Terminal MVP includes command palette and OS-level commands.
- Settings include RedByte Dark + Instrument themes, density, reduce motion, shortcuts.
- Toast dismiss removes hitbox reliably.
- Every window includes provenance footer.

## Screenshot Notes (capture after changes)
- Desktop view showing TopBar + Dock + System Log icon.
- Terminal command palette overlay with filtered commands.
- Settings appearance section with theme and density toggles.
- System Log app showing recent entries + export button.
- Window chrome showing provenance footer.
- Toast dismiss interaction (before/after frame to confirm hitbox removal).
