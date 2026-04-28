export const IDE_CHROME_TOGGLES_KEY = 'rb.ide.chrome.toggles.v1';

export interface IdeChromeToggles {
  version: 1;
  designToolbarVisible: boolean;
  verifyCommandRowsVisible: boolean;
  sideRailsVisible: boolean;
  consoleVisible: boolean;
}

export const DEFAULT_IDE_CHROME_TOGGLES: IdeChromeToggles = {
  version: 1,
  designToolbarVisible: true,
  verifyCommandRowsVisible: true,
  sideRailsVisible: true,
  consoleVisible: true,
};

type ChromeToggleStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function parseIdeChromeToggles(raw: string | null | undefined): IdeChromeToggles {
  if (!raw) return DEFAULT_IDE_CHROME_TOGGLES;
  try {
    return normalizeIdeChromeToggles(JSON.parse(raw));
  } catch {
    return DEFAULT_IDE_CHROME_TOGGLES;
  }
}

export function readIdeChromeToggles(
  storage: ChromeToggleStorage | null | undefined
): IdeChromeToggles {
  if (!storage) return DEFAULT_IDE_CHROME_TOGGLES;
  try {
    return parseIdeChromeToggles(storage.getItem(IDE_CHROME_TOGGLES_KEY));
  } catch {
    return DEFAULT_IDE_CHROME_TOGGLES;
  }
}

export function writeIdeChromeToggles(
  storage: ChromeToggleStorage | null | undefined,
  toggles: IdeChromeToggles
): void {
  if (!storage) return;
  try {
    storage.setItem(IDE_CHROME_TOGGLES_KEY, JSON.stringify(normalizeIdeChromeToggles(toggles)));
  } catch {
    // localStorage can be unavailable or quota-blocked; chrome defaults remain safe.
  }
}

function normalizeIdeChromeToggles(value: unknown): IdeChromeToggles {
  if (!isRecord(value) || value.version !== 1) {
    return DEFAULT_IDE_CHROME_TOGGLES;
  }
  return {
    version: 1,
    designToolbarVisible: readBoolean(value.designToolbarVisible, DEFAULT_IDE_CHROME_TOGGLES.designToolbarVisible),
    verifyCommandRowsVisible: readBoolean(
      value.verifyCommandRowsVisible,
      DEFAULT_IDE_CHROME_TOGGLES.verifyCommandRowsVisible
    ),
    sideRailsVisible: readBoolean(value.sideRailsVisible, DEFAULT_IDE_CHROME_TOGGLES.sideRailsVisible),
    consoleVisible: readBoolean(value.consoleVisible, DEFAULT_IDE_CHROME_TOGGLES.consoleVisible),
  };
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
