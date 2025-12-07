export interface RedstoneSessionState {
  activeBlueprintName: string | null;
}

let state: RedstoneSessionState = {
  activeBlueprintName: null,
};

type Listener = (s: RedstoneSessionState) => void;
const listeners: Listener[] = [];

function notify() {
  for (const l of listeners) {
    try {
      l({ ...state });
    } catch {
      // ignore
    }
  }
}

export function getRedstoneSessionState(): RedstoneSessionState {
  return { ...state };
}

export function setActiveBlueprintName(name: string | null) {
  state = {
    ...state,
    activeBlueprintName: name,
  };
  notify();
}

export function getActiveBlueprintName(): string | null {
  return state.activeBlueprintName;
}

export function subscribeRedstoneSession(fn: Listener) {
  listeners.push(fn);
  fn({ ...state });
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

