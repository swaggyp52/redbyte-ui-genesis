export const NEO_MODE_ICONS = {
  build: '◧',
  simulate: '◩',
  hardware: '◪',
  submit: '◫',
};

/** Retained icon keys own this dictionary contract; no deleted workspace dependency. */
export type NeoMode = keyof typeof NEO_MODE_ICONS;

export const NEO_ACTION_ICONS = {
  examples: '▣',
  exportEvidence: '▤',
  openEvidence: '▥',
  run: '▷',
  pause: '▌▌',
  step: '▹',
  safeMode: '◈',
  blocking: '■',
  warning: '▲',
} as const;
