#!/usr/bin/env node

import assert from 'assert/strict';
import path from 'path';
import {
  classifyClaimStatus,
  detectCompletedSliceSignals,
  markdownFromControl,
  parseQueue,
  isGeneratedRunPath,
  REQUIRED_SECTIONS,
} from './rb-control-loop.mjs';

function testQueueParserSkipsDoneShape() {
  const md = [
    '## Queue',
    '',
    '| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |',
    '|---|---|---|---|---|---|',
    '| 2 | Finish honest proof closure | Proof | docs | docs: | capture proof |',
    '| ~~6~~ | ~~Curate starter and example learning path~~ | ~~Done~~ | - | - | **Done 2026-05-05** |',
  ].join('\n');
  const items = parseQueue(md);
  assert.equal(items.length, 2);
  assert.equal(items[0].done, false);
  assert.equal(items[1].done, true);
}

function testStaleLearningPathDetection() {
  const queueItems = [
    {
      number: 6,
      slice: 'Curate starter and example learning path',
      done_criteria: 'Existing starters gain short purpose copy',
      done: false,
    },
  ];
  const completed = detectCompletedSliceSignals({
    queueItems,
    recentLog: '13d77a3b feat(examples): curate v1 learning path',
    activeWork: '',
    aiState: '',
  });
  assert.equal(completed.length, 1);
  assert.equal(completed[0].slice, 'Curate starter and example learning path');
}

function testClaimClassification() {
  const claim = { minimum_evidence_level: 'L2' };
  assert.equal(classifyClaimStatus(claim, {
    docs: { found: ['doc'], missing: [] },
    code: { found: ['code'], missing: [] },
    tests: { found: ['test'], missing: [] },
  }), 'proven');
  assert.equal(classifyClaimStatus(claim, {
    docs: { found: ['doc'], missing: [] },
    code: { found: [], missing: [] },
    tests: { found: [], missing: [] },
  }), 'documented only');
}

function testGeneratedPathGuard() {
  const ok = path.resolve('.redbyte/agent/runs/control-next-latest.md');
  assert.equal(isGeneratedRunPath(ok), true);
  assert.equal(isGeneratedRunPath(path.resolve('AI_STATE.md')), false);
}

function testControlMarkdownSections() {
  const payload = Object.fromEntries(REQUIRED_SECTIONS.map((key) => [key, key]));
  payload.completed_slice_signals = [];
  const md = markdownFromControl(payload);
  for (const key of REQUIRED_SECTIONS) {
    assert.ok(md.includes(`## ${key.replace(/_/g, ' ')}`), key);
  }
}

testQueueParserSkipsDoneShape();
testStaleLearningPathDetection();
testClaimClassification();
testGeneratedPathGuard();
testControlMarkdownSections();

process.stdout.write('[rb-control-test] [ok] focused control-loop tests passed.\n');
