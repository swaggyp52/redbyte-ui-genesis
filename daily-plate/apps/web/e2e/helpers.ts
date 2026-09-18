import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
export const serverDir = path.resolve(here, '../../server');

export function createInvite(name = 'Mom', recoverUserId?: string): string {
  const env = { ...process.env, DP_DATA_DIR: process.env.DP_E2E_DATA_DIR ?? '', DP_ORIGINS: 'http://localhost:8790', DP_PORT: '8790' };
  const args = [path.join(serverDir, 'dist/cli.js'), 'invite', '--name', name];
  if (recoverUserId) args.push('--recover', recoverUserId);
  const out = execFileSync(process.execPath, args, { env, encoding: 'utf8' });
  const m = /#invite=([A-Za-z0-9_-]+)/.exec(out);
  if (!m) throw new Error(`no invite in output: ${out}`);
  return m[1]!;
}

export async function signUpThroughUi(page: Page, token: string, name = 'Mom'): Promise<void> {
  await page.goto(`/#invite=${token}`);
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: 'Connect this phone' }).click();
  await page.getByRole('heading', { name: `Hi ${name}` }).waitFor();
}

export async function completeSetup(page: Page): Promise<void> {
  await page.getByText('165 g on training days is taken as carbohydrates').waitFor();
  await page.getByRole('button', { name: 'Looks right' }).click();
  await page.getByRole('heading', { name: 'Quick unlock' }).waitFor();
  await page.getByRole('button', { name: 'Later' }).click();
  await page.getByRole('heading', { name: 'Put it on your Home Screen' }).waitFor();
  await page.getByRole('button', { name: 'Start logging' }).click();
  await page.getByRole('heading', { name: 'Today' }).waitFor();
}

export async function addShakeFromLabel(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Add Food' }).click();
  await page.getByRole('button', { name: 'Custom food' }).click();
  await page.getByLabel('Name').fill('My shake');
  await page.getByLabel('One serving is').fill('1 bottle');
  await page.getByLabel('What do you call one serving?').fill('bottle');
  await page.getByLabel('Protein in g').fill('30');
  await page.getByLabel('Carbs in g').fill('15');
  await page.getByLabel('Fiber in g').fill('5');
  await page.getByLabel('Fat kind').selectOption('unknown');
  await page.getByLabel('Sugar kind').selectOption('unknown');
  await page.getByLabel('Calories kind').selectOption('unknown');
  await page.getByRole('button', { name: 'Save food' }).click();
  await page.getByRole('dialog', { name: 'How much?' }).waitFor();
}
