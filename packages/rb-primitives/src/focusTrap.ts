export interface FocusTrapOptions {
  /**
   * Called when focus attempts to leave the trap.
   */
  onEscape?: () => void;
}

/**
 * createFocusTrap registers a keydown handler that keeps focus inside the
 * provided container by recycling focusable elements when the user presses
 * Tab or Shift+Tab. This is intentionally lightweight so that primitives and
 * windowing can share the same behaviour without bringing in an external
 * dependency.
 */
export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}) {
  const getFocusable = () =>
    Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.hasAttribute('disabled'));

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      options.onEscape?.();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        last.focus();
        event.preventDefault();
      }
      return;
    }

    if (active === last) {
      first.focus();
      event.preventDefault();
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}
