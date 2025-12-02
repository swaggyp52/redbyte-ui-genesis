import { emitToast } from "../events/events";

export interface OSAction {
  id: string;
  label: string;
  run: () => void;
}

let registered: OSAction[] = [];

export function registerAction(a: OSAction) {
  registered.push(a);
}

export function getActions(): OSAction[] {
  return registered;
}

registerAction({
  id: "os:clear-toasts",
  label: "Clear all notifications",
  run: () => {
    emitToast({
      title: "Notifications cleared",
      body: "OS events flushed.",
      level: "info",
    });
  },
});
