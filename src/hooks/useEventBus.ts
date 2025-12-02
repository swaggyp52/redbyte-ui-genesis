import { useEffect } from "react";
import type { OSEvent, OSEventListener } from "../os/events/events";
import { subscribe } from "../os/events/events";

export function useEventBus(handler: OSEventListener) {
  useEffect(() => {
    const off = subscribe((event: OSEvent) => {
      handler(event);
    });
    return () => off();
  }, [handler]);
}
