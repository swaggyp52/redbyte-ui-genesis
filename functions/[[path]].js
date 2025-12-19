export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (request.method !== "GET" && request.method !== "HEAD") return next();

  const accept = request.headers.get("Accept") || "";
  const wantsHTML = accept.includes("text/html");

  const last = url.pathname.split("/").pop() || "";
  const hasExt = last.includes(".");

  // Only SPA-fallback for HTML navigation requests with no file extension.
  if (!wantsHTML || hasExt) return next();

  let res = await next();
  if (res.status === 404) {
    url.pathname = "/index.html";
    res = await next(new Request(url.toString(), request));
  }
  return res;
}