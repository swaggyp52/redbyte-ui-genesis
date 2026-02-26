import { useEffect, useState } from "react";

const BOOT_DURATION = 1200;

export function useBoot() {
  const [isBooted, setIsBooted] = useState(false);
  const [bootMessage] = useState("Initializing NeonOS shell...");

  useEffect(() => {
    const timer = setTimeout(() => setIsBooted(true), BOOT_DURATION);
    return () => clearTimeout(timer);
  }, []);

  return { isBooted, bootMessage };
}

