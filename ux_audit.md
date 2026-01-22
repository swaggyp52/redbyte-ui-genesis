# UX Audit — RedByte OS (Phase 3, Track 7)

## Manual OS-Level UX Audit

### 1. Window & Focus Behavior
- [ ] New windows sometimes open partially off-screen, especially on smaller displays or after resizing the main window.
- [ ] Z-ordering of windows is inconsistent; sometimes a newly opened window appears behind others.
- [ ] Active window highlighting is subtle or missing, making it hard to tell which window is focused.
- [ ] When Logic Playground opens, initial focus is not always on the main canvas or a primary control.
- [ ] RightDock and inspectors are not always visible when contextually relevant (e.g., after opening a circuit or switching perspective).

### 2. Layout & Navigation Predictability
- [ ] Logic Playground sometimes loads with the viewport not centered on the circuit, or at an unexpected zoom level.
- [ ] Important controls (e.g., Run, Export, Perspective Switcher) may be off-screen or require manual resizing to access.
- [ ] Perspective switching (Build/Analyze/Debug) can feel abrupt; state transitions are not always visually clear.
- [ ] Keyboard navigation is inconsistent; some shortcuts work only in certain modes, and focus is not always predictable after switching.

### 3. Canvas Interaction Polish
- [ ] Dragging nodes can feel laggy, especially with many elements on the canvas.
- [ ] Pan/zoom is sometimes jumpy or too sensitive to scroll-wheel input.
- [ ] Scroll-wheel can conflict with browser scrolling or other UI elements.
- [ ] Node movement can be imprecise, with accidental small moves or drops.
- [ ] Accidental selection or deselection occurs when clicking near, but not on, a node.

### 4. OS Mental Model Clarity
- [ ] Users may not always know which mode they are in (Build/Analyze/Debug), especially after certain actions.
- [ ] Mode changes (e.g., switching from Build to Analyze) are not always accompanied by clear visual or behavioral cues.
- [ ] Some state transitions (e.g., opening/closing inspectors, switching files) are abrupt, with little feedback.

---

## Why These Matter
- Friction in window management and focus leads to confusion and lost work.
- Unpredictable layout or navigation increases onboarding time and user frustration.
- Canvas interaction issues make circuit building and debugging feel clumsy.
- Lack of clarity in OS modes undermines user confidence and predictability.

---

## Next Step
Rank these issues (P0/P1/P2) and create an implementation plan for minimal, targeted fixes.
