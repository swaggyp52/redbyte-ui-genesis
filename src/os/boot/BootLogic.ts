export interface BootStep {
  label: string;
  duration: number; // ms
}

export const BOOT_SEQUENCE: BootStep[] = [
  { label: "Initializing kernel", duration: 400 },
  { label: "Loading RedByte frameworks", duration: 500 },
  { label: "Starting system services", duration: 700 },
  { label: "Preparing UI subsystem", duration: 450 },
  { label: "Launching desktop environment", duration: 850 },
];

export async function runBootSequence(onProgress: (p: number, label: string) => void) {
  let total = BOOT_SEQUENCE.reduce((sum, s) => sum + s.duration, 0);
  let elapsed = 0;

  for (const step of BOOT_SEQUENCE) {
    const chunk = step.duration;
    const start = elapsed;
    const end = elapsed + chunk;

    const startTime = performance.now();
    while (true) {
      const now = performance.now();
      const local = now - startTime;

      if (local >= chunk) break;

      const globalProgress = (start + local) / total;
      onProgress(Math.min(1, globalProgress), step.label);
      await new Promise(r => setTimeout(r, 16));
    }

    elapsed = end;
    onProgress(elapsed / total, step.label);
  }

  onProgress(1, "Done");
}

