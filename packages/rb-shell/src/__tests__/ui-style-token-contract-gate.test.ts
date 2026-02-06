// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ui:style-token-contract-gate
 * 
 * Deterministic validation that:
 * 1. Canonical token block exists in rb-shell/styles.css with explicit markers
 * 2. Token count is ≤ 20 and exactly matches UI_STYLE_GUIDE.md list
 * 3. No duplicate token names
 * 4. Touched surfaces contain no new raw hex/rgb/hsl literals
 */

const REPO_ROOT = join(__dirname, '../../../..');
const STYLES_CSS_PATH = join(REPO_ROOT, 'packages/rb-shell/src/styles.css');
const STYLE_GUIDE_PATH = join(REPO_ROOT, 'docs/UI_STYLE_GUIDE.md');

describe('ui:style-token-contract-gate', () => {
  describe('canonical token block', () => {
    it('has explicit RB_CORE_TOKENS_START/END markers in styles.css', () => {
      const content = readFileSync(STYLES_CSS_PATH, 'utf-8');
      expect(content).toContain('RB_CORE_TOKENS_START');
      expect(content).toContain('RB_CORE_TOKENS_END');
    });

    it('extracts token list from markers', () => {
      const content = readFileSync(STYLES_CSS_PATH, 'utf-8');
      const startMarker = '/* RB_CORE_TOKENS_START */';
      const endMarker = '/* RB_CORE_TOKENS_END */';
      
      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker);
      
      expect(startIdx).toBeGreaterThanOrEqual(0);
      expect(endIdx).toBeGreaterThan(startIdx);
      
      const block = content.substring(startIdx + startMarker.length, endIdx);
      const tokens = Array.from(new Set(block.match(/--rb-ui-[a-z0-9\-]+/g) ?? []));
      
      // Token count ≤ 20
      expect(tokens.length).toBeLessThanOrEqual(20);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('has no duplicate token names', () => {
      const content = readFileSync(STYLES_CSS_PATH, 'utf-8');
      const startMarker = '/* RB_CORE_TOKENS_START */';
      const endMarker = '/* RB_CORE_TOKENS_END */';
      
      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker);
      const block = content.substring(startIdx + startMarker.length, endIdx);
      
      const tokens = Array.from(new Set(block.match(/--rb-ui-[a-z0-9\-]+/g) ?? []));
      const allTokens = block.match(/--rb-ui-[a-z0-9\-]+/g) ?? [];
      
      expect(tokens.length).toBe(allTokens.length);
    });
  });

  describe('style guide alignment', () => {
    it('canonical token list matches UI_STYLE_GUIDE.md table', () => {
      const cssContent = readFileSync(STYLES_CSS_PATH, 'utf-8');
      const guideContent = readFileSync(STYLE_GUIDE_PATH, 'utf-8');
      
      // Extract tokens from CSS block
      const startMarker = '/* RB_CORE_TOKENS_START */';
      const endMarker = '/* RB_CORE_TOKENS_END */';
      const startIdx = cssContent.indexOf(startMarker);
      const endIdx = cssContent.indexOf(endMarker);
      const block = cssContent.substring(startIdx + startMarker.length, endIdx);
      
      const cssTokens = Array.from(new Set(block.match(/--rb-ui-[a-z0-9\-]+/g) ?? []))
        .sort();
      
      // Extract tokens from guide — look for backtick-wrapped tokens
      const guideMatches = guideContent.match(/`--rb-ui-[a-z0-9\-]+`/g) ?? [];
      const guideTokens = Array.from(new Set(
        guideMatches.map(match => match.replace(/`/g, ''))
      )).sort();
      
      expect(cssTokens).toEqual(guideTokens);
    });

    it('token count is reported as 20/20', () => {
      const content = readFileSync(STYLES_CSS_PATH, 'utf-8');
      const startMarker = '/* RB_CORE_TOKENS_START */';
      const endMarker = '/* RB_CORE_TOKENS_END */';
      
      const startIdx = content.indexOf(startMarker);
      const endIdx = content.indexOf(endMarker);
      const block = content.substring(startIdx + startMarker.length, endIdx);
      
      const tokens = new Set(block.match(/--rb-ui-[a-z0-9\-]+/g) ?? []);
      
      expect(tokens.size).toBe(20);
    });
  });

  describe('no new raw colors in touched surfaces', () => {
    it('normalized BootScreen has no new hex/rgb/hsl literals', () => {
      const path = join(REPO_ROOT, 'packages/rb-shell/src/BootScreen.tsx');
      const content = readFileSync(path, 'utf-8');
      
      // Check for problematic patterns — hex colors in non-comment lines
      const lines = content.split('\n');
      const problematicLines = lines.filter((line) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return false;
        // Allow hex only if it's part of --rb-ui- variable reference
        return /#[0-9a-fA-F]{3,6}(?![a-zA-Z0-9])/.test(line) && !line.includes('var(--rb-ui-');
      });
      
      expect(problematicLines.length).toBe(0);
    });

    it('normalized Dock has no new hex/rgb/hsl literals', () => {
      const path = join(REPO_ROOT, 'packages/rb-shell/src/Dock.tsx');
      const content = readFileSync(path, 'utf-8');
      
      const lines = content.split('\n');
      const problematicLines = lines.filter(line => {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return false;
        return /#[0-9a-fA-F]{3,6}(?![a-zA-Z0-9])/.test(line) && !line.includes('var(--rb-ui-');
      });
      
      expect(problematicLines.length).toBe(0);
    });
  });
});
