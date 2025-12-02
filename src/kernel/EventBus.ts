export type RBEvent =
  | { type: "window:focused"; windowId: string }
  | { type: "window:moved"; windowId: string }
  | { type: "window:resized"; windowId: string }
  | {
      type: "window:snap";
      windowId: string;
      mode: "left" | "right" | "top" | "none";
    }
  | { type: "window:opened"; windowId: string; appId: string; title: string }
  | { type: "window:closed"; windowId: string };

type Listener = (ev: RBEvent) => void;

class EventBus {
  private listeners: Listener[] = [];

  emit(ev: RBEvent) {
    for (const L of this.listeners) {
      try {
        L(ev);
      } catch {
        // ignore listener errors
      }
    }
  }

  subscribe(fn: Listener) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
}

export const RBEvents = new EventBus();
