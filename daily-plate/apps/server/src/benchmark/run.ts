/**
 * Catalog coverage harness. Replays the fixed 80-case set through the real
 * SearchService and records, per case: whether anything came back, the rank
 * of a plausible match, portion usability and nutrient completeness.
 *
 *   node dist/benchmark/run.js --mode replay   # answers from fixtures/captures (default; no network)
 *   node dist/benchmark/run.js --mode live     # explicit, rate-bounded live run; needs DP_USDA_API_KEY
 *
 * Replay mode measures the harness, not real coverage: the report says so.
 * Live results are only claims about the moment they were captured.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config.js';
import { openDatabase } from '../db/database.js';
import { Store } from '../db/store.js';
import { SearchService } from '../services/search.js';
import { fixtureFetch } from '../providers/stub.js';
import type { FoodCandidate } from '@daily-plate/contracts';
import { MACRO_KEYS, tokenize } from '@daily-plate/domain';

interface Case {
  id: string;
  category: string;
  query: string;
  intendedIdentity: string;
  preparation: string;
  acceptablePortion: string;
  exactBrandRequired: boolean;
  negative: boolean;
  notes?: string;
}

interface Result {
  id: string;
  category: string;
  query: string;
  providerStatus: string;
  returned: number;
  /** 1-based rank of the first candidate whose name shares most identity tokens; null when none. */
  plausibleRank: number | null;
  plausibleName: string | null;
  portionUsable: boolean;
  macrosComplete: boolean;
  exactBrand: 'n/a' | 'yes' | 'no' | 'unknown';
  latencyMs: number;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n: string): string | undefined => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const mode = flag('mode') ?? 'replay';
const fixturesDir = flag('fixtures') ?? path.resolve(here, '../../../../fixtures');
const casesFile = path.join(fixturesDir, 'benchmark/catalog-cases.json');
const cases = (JSON.parse(fs.readFileSync(casesFile, 'utf8')) as { cases: Case[] }).cases;
const outDir = flag('out') ?? path.resolve(here, '../../../../test-results/benchmark');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-bench-'));
const config = loadConfig({ dataDir, dbPath: path.join(dataDir, 'bench.db'), logLevel: 'silent' });
const db = openDatabase(config.dbPath);
const store = new Store(db);
const user = store.createUser('bench', 'UTC');
const service = new SearchService(store, {
  usdaApiKey: mode === 'live' ? config.usdaApiKey : 'replay',
  userAgent: `DailyPlate-bench/${config.version} (${config.providerContact})`,
  ...(mode === 'live' ? {} : { fetchImpl: fixtureFetch(fixturesDir) }),
});
if (mode === 'live' && !config.usdaApiKey) {
  console.error('live mode needs DP_USDA_API_KEY');
  process.exit(2);
}

const plausible = (c: Case, cand: FoodCandidate): boolean => {
  const want = new Set(tokenize(c.intendedIdentity).filter((t) => t.length > 2));
  const have = new Set([...tokenize(cand.name), ...(cand.brand ? tokenize(cand.brand) : [])]);
  let hits = 0;
  for (const w of want) if (have.has(w)) hits += 1;
  return want.size > 0 && hits / want.size >= 0.5;
};

const results: Result[] = [];
for (const c of cases) {
  const started = Date.now();
  const barcode = /^barcode (\d+)$/.exec(c.query);
  let candidates: FoodCandidate[] = [];
  let status = 'skipped';
  if (barcode) {
    const r = await service.barcode(user.id, barcode[1]!, true);
    if (!('error' in r)) {
      status = r.providerStatus;
      if (r.candidate) candidates = [r.candidate];
    }
  } else {
    const r = await service.search(user.id, c.query.replace(/^\d+(\.\d+)?\s+/, '').replace(/^half /, ''), 'online', 1);
    status = r.providerStatus;
    candidates = r.results.filter((x) => x.kind === 'candidate').map((x) => (x as { candidate: FoodCandidate }).candidate);
  }
  const idx = candidates.findIndex((cand) => plausible(c, cand));
  const top = idx >= 0 ? candidates[idx]! : undefined;
  results.push({
    id: c.id,
    category: c.category,
    query: c.query,
    providerStatus: status,
    returned: candidates.length,
    plausibleRank: idx >= 0 ? idx + 1 : null,
    plausibleName: top?.name ?? null,
    portionUsable: Boolean(top && (top.portions.length > 0 || top.basis.kind === 'serving')),
    macrosComplete: Boolean(top && MACRO_KEYS.every((k) => top.nutrients[k].status === 'reported')),
    exactBrand: !c.exactBrandRequired ? 'n/a' : top ? (top.brand ? 'unknown' : 'no') : 'no',
    latencyMs: Date.now() - started,
  });
  if (mode === 'live') await new Promise((r) => setTimeout(r, 4000)); // rate-bounded: well under USDA/OFF limits
}

const byCat: Record<string, { cases: number; found: number; top3: number; portion: number; complete: number; negativesHonest: number }> = {};
for (const r of results) {
  const c = cases.find((x) => x.id === r.id)!;
  const b = (byCat[r.category] ??= { cases: 0, found: 0, top3: 0, portion: 0, complete: 0, negativesHonest: 0 });
  b.cases += 1;
  if (c.negative) {
    if (r.plausibleRank === null) b.negativesHonest += 1;
    continue;
  }
  if (r.plausibleRank !== null) b.found += 1;
  if (r.plausibleRank !== null && r.plausibleRank <= 3) b.top3 += 1;
  if (r.portionUsable) b.portion += 1;
  if (r.macrosComplete) b.complete += 1;
}
const report = {
  mode,
  measured: mode === 'live',
  coverageClaim: mode === 'live' ? 'Live provider responses at the time of the run; see environment.' : 'NOT MEASURED — replay against fixtures exercises the harness and normalizers only.',
  environment: { node: process.version, platform: `${process.platform}/${process.arch}`, at: new Date().toISOString(), fixturesDir: mode === 'live' ? null : fixturesDir },
  totals: { cases: cases.length, withPlausibleResult: results.filter((r) => r.plausibleRank !== null).length },
  byCategory: byCat,
  results,
};
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `catalog-${mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ file, mode, measured: report.measured, coverageClaim: report.coverageClaim, byCategory: byCat }, null, 2));
db.close();
fs.rmSync(dataDir, { recursive: true, force: true });
