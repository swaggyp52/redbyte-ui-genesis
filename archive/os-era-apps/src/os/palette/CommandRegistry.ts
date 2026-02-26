export interface Command {
  id: string;
  label: string;
  keywords: string[];
  action: () => void;
}

let listeners: ((cmd: Command) => void)[] = [];

export function onCommand(f: (cmd: Command) => void) {
  listeners.push(f);
}

export function emitCommand(cmd: Command) {
  for (const f of listeners) f(cmd);
}

// Temporary store; Desktop will fill this at runtime.
export const Commands: Command[] = [];

export function registerCommand(cmd: Command) {
  Commands.push(cmd);
}

