# Accessibility Guarantees

The Genesis desktop targets predictable, keyboard-first interaction. The guarantees below cover primitives, windowing, and higher-level desktop experiences.

## Focus Management
- Every interactive element is keyboard reachable with visible focus styles.
- Focus traps are available via `createFocusTrap` in `@rb/rb-primitives` and re-exported from `@rb/rb-windowing` for dialogs and windows.
- Escape closes transient UI like menus and tooltips; focus returns to the launcher control.
- Windows are announced as dialogs with titles for assistive tech and expose window controls with clear labels.

## Roles and Labels
- Buttons, menu items, and tooltips define appropriate ARIA roles and labeling.
- Window chrome (close/minimize/maximize) uses descriptive `aria-label` and `aria-pressed` where applicable.
- Tooltip content is associated to triggers via `aria-describedby`.

## Keyboard-Only Navigation
- Tab order respects taskbar → desktop windows → in-window controls.
- Alt+Tab cycles windows in z-order without leaking focus between windows.
- ESC closes menus and returns focus to the invoking control.

## Test Expectations
- Playwright a11y suite validates focus confinement per window, dialog tree structure, and reachability of dock/taskbar items.
- Keyboard regression tests cover tab ordering, Alt+Tab switching, and ESC handling for menus.
