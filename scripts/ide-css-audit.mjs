import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const rootCssPath = path.join(
  repoRoot,
  'packages',
  'rb-apps',
  'src',
  'apps',
  'ide',
  'ide-root.css'
);
const polishCssPath = path.join(
  repoRoot,
  'packages',
  'rb-apps',
  'src',
  'apps',
  'ide',
  'ide-polish-pass.css'
);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineCount(text) {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitSelectorList(raw) {
  const selectors = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '(') parenDepth += 1;
    if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === '[') bracketDepth += 1;
    if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);

    if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      const piece = current.trim();
      if (piece) selectors.push(piece);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) selectors.push(tail);
  return selectors;
}

function isKeyframeStepSelector(selector) {
  const normalized = selector.trim().toLowerCase();
  return normalized === 'from' || normalized === 'to' || /^\d+%$/.test(normalized);
}

function extractSelectors(css) {
  const selectors = [];
  const noComments = stripComments(css);
  const ruleRegex = /([^{}@][^{}]*?)\{/g;
  let match;

  while ((match = ruleRegex.exec(noComments)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    if (raw.startsWith('@')) continue;
    if (raw.includes('}')) continue;
    const parts = splitSelectorList(raw)
      .map((p) => p.trim())
      .filter(Boolean)
      .filter((p) => !isKeyframeStepSelector(p));
    selectors.push(...parts);
  }

  return selectors;
}

function countMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }
  return map;
}

function sortMapDescending(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function extractPhaseMarkers(css) {
  const lines = css.split(/\r?\n/);
  const phasePattern = /(phase|slice|section|§|teal detox|canvas immersion|workstation reset)/i;
  const markers = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('/*')) continue;
    if (!phasePattern.test(line)) continue;
    markers.push({ line: i + 1, text: line.replace(/\s+/g, ' ').slice(0, 160) });
  }
  return markers;
}

function extractSubstringSelectors(css) {
  const selectors = extractSelectors(css);
  const pattern = /\[[^\]]*[*^$]=['"][^'"]+['"][^\]]*\]/;
  return selectors.filter((selector) => pattern.test(selector));
}

function extractRawColorValues(css) {
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  const rgb = css.match(/rgba?\([^\)]+\)/g) ?? [];
  const hsl = css.match(/hsla?\([^\)]+\)/g) ?? [];
  return [...hex, ...rgb, ...hsl].map((v) => v.replace(/\s+/g, ''));
}

function normalizeSelector(selector) {
  return selector.replace(/\s+/g, ' ').trim();
}

function summarizeFile(filePath, label) {
  const css = readText(filePath);
  const selectors = extractSelectors(css).map(normalizeSelector);
  const selectorMap = countMap(selectors);
  const substringSelectors = extractSubstringSelectors(css).map(normalizeSelector);
  const colorMap = countMap(extractRawColorValues(css));
  const repeatedColors = sortMapDescending(colorMap)
    .filter(([, count]) => count >= 8)
    .slice(0, 25)
    .map(([value, count]) => ({ value, count }));

  return {
    label,
    file: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
    lineCount: lineCount(css),
    selectorCount: selectors.length,
    uniqueSelectorCount: selectorMap.size,
    phaseMarkers: extractPhaseMarkers(css),
    substringSelectors: [...new Set(substringSelectors)],
    topRepeatedSelectors: sortMapDescending(selectorMap)
      .filter(([, count]) => count > 1)
      .slice(0, 25)
      .map(([selector, count]) => ({ selector, count })),
    repeatedRawColors: repeatedColors,
  };
}

const rootSummary = summarizeFile(rootCssPath, 'ide-root');
const polishSummary = summarizeFile(polishCssPath, 'ide-polish-pass');

const rootSelectorSet = new Set(
  extractSelectors(readText(rootCssPath)).map(normalizeSelector)
);
const polishSelectorSet = new Set(
  extractSelectors(readText(polishCssPath)).map(normalizeSelector)
);

const overlapSelectors = [...rootSelectorSet]
  .filter((selector) => polishSelectorSet.has(selector))
  .sort((a, b) => a.localeCompare(b));

const report = {
  generatedAtIso: new Date().toISOString(),
  files: {
    root: rootSummary,
    polish: polishSummary,
  },
  overlap: {
    selectorCount: overlapSelectors.length,
    selectors: overlapSelectors,
  },
  broadSubstringSelectors: {
    root: rootSummary.substringSelectors,
    polish: polishSummary.substringSelectors,
  },
};

console.log(JSON.stringify(report, null, 2));