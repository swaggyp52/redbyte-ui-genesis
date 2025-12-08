export type ToastLevel = "info" | "success" | "error";

export type OSEvent =
  | {
      type: "toast";
      id: string;
      title: string;
      body?: string;
      level: ToastLevel;
      timestamp: number;
    };

export type OSEventListener = (event: OSEvent) => void;

const listeners = new Set<OSEventListener>();

export function subscribe(listener: OSEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emit(event: OSEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

export function emitToast(params: {
  title: string;
  body?: string;
  level?: ToastLevel;
}) {
  const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  emit({
    type: "toast",
    id,
    title: params.title,
    body: params.body,
    level: params.level ?? "info",
    timestamp: Date.now(),
  });
}

