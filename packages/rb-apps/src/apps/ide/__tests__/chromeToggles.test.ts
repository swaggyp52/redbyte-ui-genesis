import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_IDE_CHROME_TOGGLES,
  IDE_CHROME_TOGGLES_KEY,
  parseIdeChromeToggles,
  readIdeChromeToggles,
  writeIdeChromeToggles,
} from '../chromeToggles';

describe('IDE chrome toggles persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to safe defaults when storage is empty or malformed', () => {
    expect(parseIdeChromeToggles(null)).toEqual(DEFAULT_IDE_CHROME_TOGGLES);
    expect(parseIdeChromeToggles('not-json{{')).toEqual(DEFAULT_IDE_CHROME_TOGGLES);
    expect(parseIdeChromeToggles(JSON.stringify({ version: 0, sideRailsVisible: false }))).toEqual(
      DEFAULT_IDE_CHROME_TOGGLES
    );
  });

  it('normalizes missing fields without crashing the IDE', () => {
    expect(parseIdeChromeToggles(JSON.stringify({ version: 1, sideRailsVisible: false }))).toEqual({
      ...DEFAULT_IDE_CHROME_TOGGLES,
      sideRailsVisible: false,
    });
  });

  it('reads and writes the versioned localStorage key', () => {
    const next = {
      version: 1 as const,
      designToolbarVisible: false,
      verifyCommandRowsVisible: false,
      sideRailsVisible: false,
      consoleVisible: false,
    };

    writeIdeChromeToggles(localStorage, next);

    expect(localStorage.getItem(IDE_CHROME_TOGGLES_KEY)).toBe(JSON.stringify(next));
    expect(readIdeChromeToggles(localStorage)).toEqual(next);
  });
});
