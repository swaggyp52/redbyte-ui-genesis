#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';

import {
  buildProblemPacket,
  classifyFeedback,
  DEFAULT_CONFIG,
  doNotBuild,
  isPathUnder,
  mapFeedbackToSurfaces,
  markdownFromExecutionPrompt,
  overengineeringRisks,
  REQUIRED_PROBLEM_KEYS,
  validateProblemPacket,
} from './rb-product-feedback.mjs';

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

test('raw feedback is preserved exactly', () => {
  const raw = 'This feels overbuilt and not like what I asked for.';
  const packet = buildProblemPacket(raw, {
    config: DEFAULT_CONFIG,
    memoryHits: [],
    repoHits: [],
  });
  assert.equal(packet.raw_feedback, raw);
});

test('problem packet schema validates required keys', () => {
  const packet = buildProblemPacket('Map Pins feels like two different sections and I do not know what action I am supposed to take.', {
    config: DEFAULT_CONFIG,
    memoryHits: [],
    repoHits: [],
  });
  for (const key of REQUIRED_PROBLEM_KEYS) {
    assert.ok(key in packet, `missing ${key}`);
  }
  assert.equal(validateProblemPacket(packet), true);
});

test('product spine mapping works for known examples', () => {
  assert.equal(mapFeedbackToSurfaces('Export repeats the same Draft export heading twice.')[0].surface, 'Export');
  assert.equal(mapFeedbackToSurfaces('Map Pins feels like two different sections.')[0].surface, 'Map Pins / Hardware');
  assert.equal(mapFeedbackToSurfaces('The design canvas feels wrong.')[0].surface, 'Design');
});

test('overengineering risks section is always present', () => {
  const risks = overengineeringRisks('Every simple issue becomes a huge elaborate redesign.', ['overengineering issue']);
  assert.ok(risks.length > 0);
  assert.match(risks.join('\n'), /broad redesign|elaborate replacement/);
});

test('generated outputs stay under problem runs directory', () => {
  assert.equal(isPathUnder('.redbyte/agent/runs/problems', '.redbyte/agent/runs/problems/problem-latest.md'), true);
  assert.equal(isPathUnder('.redbyte/agent/runs/problems', path.join('docs', 'leak.md')), false);
});

test('allowObsidianWrites is false by default', () => {
  assert.equal(DEFAULT_CONFIG.allowObsidianWrites, false);
});

test('fallback works if memory index is missing', () => {
  const packet = buildProblemPacket('Do not make RedByte a baby toy. It needs to feel serious.', {
    config: DEFAULT_CONFIG,
    memoryHits: [],
    repoHits: [],
  });
  assert.ok(packet.product_surface.includes('Product control'));
  assert.ok(packet.problem_type.includes('visual/professionalism issue'));
  assert.ok(Array.isArray(packet.obsidian_memory_hits));
});

test('prompt output includes do-not-build and definition-of-done sections', () => {
  const packet = buildProblemPacket('This feels overbuilt and not like what I asked for.', {
    config: DEFAULT_CONFIG,
    memoryHits: [],
    repoHits: [],
  });
  const prompt = markdownFromExecutionPrompt(packet);
  assert.match(prompt, /Do not build:/);
  assert.match(prompt, /Definition of done:/);
});

test('classification includes scope and overengineering for broad redesign feedback', () => {
  const types = classifyFeedback('Every simple issue becomes a huge elaborate redesign.', DEFAULT_CONFIG);
  assert.ok(types.includes('overengineering issue'));
  assert.ok(types.includes('scope creep'));
});

test('do-not-build blocks Obsidian writes and product-spine rewrites', () => {
  const items = doNotBuild(['overengineering issue']);
  assert.match(items.join('\n'), /Obsidian/);
  assert.match(items.join('\n'), /Project -> Design -> Verify/);
});
