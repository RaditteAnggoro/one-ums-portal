import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ignored = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
]);
async function proxy(request: NextRequest) {
  const origin = new URL(process.env.API_ORIGIN ?? "http://127.0.0.1:4100");
  const incoming = new URL(request.url),
    headers = new Headers();
  for (const [key, value] of request.headers)
    if (!ignored.has(key.toLowerCase())) headers.set(key, value);
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (!["GET", "HEAD"].includes(request.method) && request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 16 * 1024 * 1024) {
        await reader.cancel();
        return Response.json(
          { message: "Ukuran permintaan melebihi 16 MB." },
          { status: 413 },
        );
      }
      chunks.push(next.value);
    }
    body = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
  }
  try {
    const upstream = await fetch(
      origin.origin + incoming.pathname + incoming.search,
      {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      },
    );
    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers)
      if (
        !ignored.has(key.toLowerCase()) &&
        key.toLowerCase() !== "set-cookie" &&
        key.toLowerCase() !== "content-encoding"
      )
        responseHeaders.set(key, value);
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append("set-cookie", cookie);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { message: "Layanan belum siap. Silakan coba lagi." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
  proxy as HEAD,
};
