export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const accept = request.headers.get("Accept") || "";
  const wantsHTML = accept.includes("text/html");

  const last = url.pathname.split("/").pop() || "";
  const hasExt = last.includes(".");

  // Only handle HTML navigation requests with no file extension.
  if (!wantsHTML || hasExt) return next();

  const forceHtmlInline = (res) => {
    const h = new Headers(res.headers);
    h.set("Content-Type", "text/html; charset=utf-8");
    h.set("Content-Disposition", "inline");
    h.set("Cache-Control", "no-store");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  };

  // Force "/" and directory-style paths to "/index.html" so we always return real HTML (correct MIME).
  if (url.pathname === "/" || url.pathname.endsWith("/")) {
    url.pathname = "/index.html";
    const res = await next(new Request(url.toString(), request));
    return forceHtmlInline(res);
  }

  // Otherwise try original path, then SPA fallback on 404.
  let res = await next();
  if (res.status !== 404) return res;

  url.pathname = "/index.html";
  res = await next(new Request(url.toString(), request));
  return forceHtmlInline(res);
}