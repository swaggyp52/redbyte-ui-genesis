export interface RootLogEntry {
  id: string;
  timestamp: string;
  message: string;
}

export function getInitialLogs(): RootLogEntry[] {
  const now = new Date();
  const ts = now.toISOString().split("T")[1]?.slice(0, 8) ?? "";

  return [
    {
      id: "boot-1",
      timestamp: ts,
      message: "RedByte OS boot sequence OK.",
    },
    {
      id: "deploy-1",
      timestamp: ts,
      message: "Last deploy: Cloudflare · status=healthy.",
    },
  ];
}

export function useRootLogs() {
  const logs = getInitialLogs();
  return { logs };
}

