import fs from 'node:fs';
import path from 'node:path';
import type { FetchLike } from './http.js';

/**
 * Test-only provider stub: answers provider URLs from fixture files so the
 * whole app can be exercised without network access. Refused in production.
 */
export function fixtureFetch(fixturesDir: string): FetchLike {
  const read = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(fixturesDir, rel), 'utf8'));
  const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  return async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.nal.usda.gov') {
      if (url.pathname.startsWith('/fdc/v1/food/')) {
        const id = url.pathname.split('/').pop();
        const file = { '1100001': 'usda/detail-egg-foundation.json', '1200001': 'usda/detail-fndds-rice.json', '2000001': 'usda/detail-branded-liquid.json' }[id ?? ''];
        return file ? json(read(file)) : new Response('', { status: 404 });
      }
      const q = (url.searchParams.get('query') ?? '').toLowerCase();
      const page = url.searchParams.get('pageNumber') ?? '1';
      if (/^\d{8,14}$/.test(q)) return json(q === '4012345678905' ? read('usda/search-gtin.json') : { totalHits: 0, foods: [] });
      // Page 1 is the plain fixture with paging fields so the phone can ask for page 2.
      if (q.includes('banana')) return json(page === '2' ? read('usda/search-banana-page2.json') : { ...(read('usda/search-banana.json') as object), totalHits: 23, currentPage: 1, totalPages: 3 });
      if (q.includes('shake')) return json(read('usda/search-branded-liquid.json'));
      if (q.includes('egg')) return json({ totalHits: 1, currentPage: 1, totalPages: 1, foods: [{ ...(read('usda/detail-egg-foundation.json') as object), foodNutrients: undefined }] });
      if (q.includes('rice')) return json({ totalHits: 1, currentPage: 1, totalPages: 1, foods: [read('usda/detail-fndds-rice.json')] });
      return json({ totalHits: 0, currentPage: 1, totalPages: 0, foods: [] });
    }
    if (url.hostname === 'world.openfoodfacts.org') {
      const code = url.pathname.split('/').pop() ?? '';
      if (code === '0012345678905') return json(read('off/product-leading-zero.json'));
      if (code === '4000000000012') return json(read('off/product-per-serving.json'));
      return json({ status: 'failure', result: { id: 'product_not_found' } }, 404);
    }
    return new Response('', { status: 500 });
  };
}
