export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const accept = request.headers.get("Accept") || "";
  const wantsHTML = accept.includes("text/html");

  const last = url.pathname.split("/").pop() || "";
  const hasExt = last.includes(".");

  // Only touch real browser navigations (HTML) with no file extension.
  if (!wantsHTML || hasExt) return next();

  const wrap = (res) => {
    // Don't interfere with redirects (prevents loops).
    if (res.status >= 300 && res.status < 400) return res;

    const h = new Headers(res.headers);
    h.set("Content-Type", "text/html; charset=utf-8");
    h.set("Content-Disposition", "inline");
    h.set("Cache-Control", "no-store");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  };

  // Try the requested path first.
  let res = await next();

  // SPA fallback on 404 -> serve the root document (NOT /index.html)
  if (res.status === 404) {
    url.pathname = "/";
    res = await next(new Request(url.toString(), request));
  }

  return wrap(res);
}