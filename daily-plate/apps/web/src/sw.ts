/// <reference lib="webworker" />
/**
 * Small explicit service worker. It precaches the app shell (manifest injected
 * at build time) and serves it cache-first. API responses are never cached:
 * the diary lives in IndexedDB, not in a shared HTTP cache.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// App-shell navigation: serve index.html for page loads that are not API calls.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/healthz/] }));

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});
