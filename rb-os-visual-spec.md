# RedByte OS Visual Spec

This spec defines the visual material system and motion rules for the OS shell and apps.

## Materials
- Surface 0 (desktop): `--rb-surface-0`
- Surface 1 (panels): `--rb-surface-1`
- Surface 2 (elevated panels): `--rb-surface-2`
- Surface 3 (control wells): `--rb-surface-3`
- Glass (translucent overlays): `--rb-glass`
- Metal (modal panels): `--rb-metal`
- Borders: `--rb-border` and `--rb-border-strong`
- Noise: `--rb-noise-opacity` applied via `.rb-noise`

## Elevation Rules
- Dock: `--rb-shadow-2`
- Windows: inactive `--rb-shadow-1`, active `--rb-shadow-2` + accent outline
- Modals: `--rb-shadow-3`
- Snap preview: `--rb-shadow-2` + accent border
- System overlays: `--rb-shadow-3`

## Window Chrome
- Titlebar height: 44px
- Icon size: 16px in a 32px container
- Title: 14px, medium weight
- Subtitle (resource id): 10px mono
- Controls: 28px buttons, subtle hover treatment only

## Motion
- Use `--rb-motion-fast`, `--rb-motion-normal`, `--rb-motion-slow` with `--rb-easing-out`
- Chrome transitions target 140ms (shadow and border only)
- Window open/close target 120-160ms scale and opacity
- Reduced motion is enforced by `data-rb-motion="reduced"`

## Dock and TopBar
- Use glass material with border and shadow
- Focus indicators use accent color, no bounce
- Hover scale is capped at 1.07, lift at 2px

## Wallpaper
- Wallpapers are defined in `packages/rb-shell/src/wallpapers.ts`
- Animated layers must use `.rb-anim` to respect reduced motion
- Desktop uses `.rb-noise` and `.rb-vignette` overlays

## Command Palette
- Glass panel with border and `--rb-shadow-3`
- Search field uses surface-2 with icon
- Results grouped by category with consistent icon sizing

## Empty and Loading States
- Use `<EmptyState />` with icon, title, and optional action
- Empty states are centered and muted (no hard errors)

## Boot
- Boot sequence is deterministic with fixed stages
- Fade out once progress reaches 100
