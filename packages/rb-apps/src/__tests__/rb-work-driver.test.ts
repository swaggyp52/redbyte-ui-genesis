import { describe, expect, it } from 'vitest';

import {
  buildNextPacketMarkdown,
  parseQueueItems,
  resolveProfile,
  section,
} from '../../../../scripts/rb-work-driver.mjs';

describe('rb-work-driver helpers', () => {
  it('extracts the queue table rows deterministically', () => {
    const markdown = [
      '# RedByte Work Queue',
      '',
      '## Queue',
      '',
      '| # | Slice | Why it matters now | Source docs | Expected commit type | Done criteria |',
      '|---|---|---|---|---|---|',
      '| 1 | Reconcile dirty or concurrent working tree | Prevent mixed commits | docs/ai-usage-rules.md | `chore:` | Tree isolated |',
      '| 3 | Project `F-P1` next-action semantics | Fix contradictory Project CTA | docs/ide/01-project.md | `fix:` | CTA agrees |',
    ].join('\n');

    expect(parseQueueItems(markdown)).toEqual([
      {
        number: 1,
        slice: 'Reconcile dirty or concurrent working tree',
        why: 'Prevent mixed commits',
        sourceDocs: 'docs/ai-usage-rules.md',
        expectedCommitType: '`chore:`',
        doneCriteria: 'Tree isolated',
      },
      {
        number: 3,
        slice: 'Project `F-P1` next-action semantics',
        why: 'Fix contradictory Project CTA',
        sourceDocs: 'docs/ide/01-project.md',
        expectedCommitType: '`fix:`',
        doneCriteria: 'CTA agrees',
      },
    ]);
  });

  it('matches queue items to the deterministic slice profiles', () => {
    expect(
      resolveProfile({
        number: 1,
        slice: 'Reconcile dirty or concurrent working tree',
        why: 'Prevent mixed commits',
      }).key,
    ).toBe('reconcile');

    expect(
      resolveProfile({
        number: 3,
        slice: 'Project `F-P1` next-action semantics',
        why: 'Fix contradictory Project CTA',
      }).key,
    ).toBe('fp1');
  });

  it('renders the next packet with the bounded contract sections', () => {
    const markdown = buildNextPacketMarkdown({
      branch: 'main',
      commit: 'abc1234',
      dirtyLines: [' M package.json'],
      dirtyFiles: ['package.json'],
      recommendedItem: {
        number: 3,
        slice: 'Project `F-P1` next-action semantics',
        why: 'Fix contradictory Project CTA',
        sourceDocs: 'docs/ide/01-project.md',
      },
      profile: {
        requiredDocs: ['AI_STATE.md', 'docs/ide/01-project.md'],
        allowedPatterns: ['packages/rb-apps/src/apps/ide/**/*'],
        forbiddenPatterns: ['Do not push.'],
        validationCommands: ['pnpm ide:gate:project-readiness-contract'],
        commitMessage: 'ide(project): fix next-action semantics',
        doneCriteria: ['CTA agrees'],
        handoffRequirements: ['Update AI_STATE.md'],
        promptFocus: 'Fix the Project next-action semantics.',
      },
    });

    expect(markdown).toContain('# RedByte Next Work Packet');
    expect(markdown).toContain('## Required docs to read first');
    expect(markdown).toContain('ide(project): fix next-action semantics');
    expect(markdown).toContain('## Claude/Copilot-ready prompt');
  });

  it('extracts named sections from the control docs by heading', () => {
    const markdown = [
      '# Example',
      '',
      '## Current truth',
      '',
      'RedByte is deterministic.',
      '',
      '## Next move',
      '',
      'Ship the bounded slice.',
    ].join('\n');

    expect(section(markdown, 'Current truth')).toBe('RedByte is deterministic.');
  });
});