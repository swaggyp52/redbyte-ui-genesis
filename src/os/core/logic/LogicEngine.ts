import { LogicGraph } from './LogicTypes';
import { stepGraph } from './LogicEval';

class LogicEngine {
  graph: LogicGraph;
  listeners: Set<() => void> = new Set();
  running: boolean = false;

  constructor() {
    this.graph = { gates: [], wires: [], values: {} };
  }

  setGraph(g: LogicGraph) {
    this.graph = g;
    this.notify();
  }

  on(fn: () => void) {
    this.listeners.add(fn);
  }

  off(fn: () => void) {
    this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn();
  }

  tick() {
    this.graph = stepGraph(this.graph);
    this.notify();
  }

  start(interval = 100) {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      setTimeout(loop, interval);
    };
    loop();
  }

  stop() {
    this.running = false;
  }
}

export const logicEngine = new LogicEngine();
