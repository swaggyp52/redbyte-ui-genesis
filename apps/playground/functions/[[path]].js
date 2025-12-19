export async function onRequest({ request, next }) {
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const accept = request.headers.get("Accept") || "";
  const wantsHTML = accept.includes("text/html");

  const last = url.pathname.split("/").pop() || "";
  const hasExt = last.includes(".");

  // Only handle HTML navigation requests with no file extension.
  if (!wantsHTML || hasExt) return next();

  // Force "/" and any directory-style path to "/index.html" so MIME is correct.
  if (url.pathname === "/" || url.pathname.endsWith("/")) {
    url.pathname = "/index.html";
    return next(new Request(url.toString(), request));
  }

  // Otherwise try the original path, then SPA-fallback on 404.
  let res = await next();
  if (res.status !== 404) return res;

  url.pathname = "/index.html";
  return next(new Request(url.toString(), request));
}