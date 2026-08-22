import { NextRequest } from "next/server";

const API_BASE_URL = process.env.PIOS_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function buildUpstreamUrl(request: NextRequest, path: string[]): URL {
  const upstreamUrl = new URL(`/${path.join("/")}`, API_BASE_URL);
  upstreamUrl.search = request.nextUrl.search;
  return upstreamUrl;
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const headers = new Headers();
  for (const headerName of ["accept", "content-type", "last-event-id"]) {
    const value = request.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  const apiToken = process.env.PIOS_API_TOKEN;
  if (apiToken) headers.set("authorization", `Bearer ${apiToken}`);

  const method = request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstream = await fetch(buildUpstreamUrl(request, path), {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  for (const headerName of ["content-type", "cache-control"]) {
    const value = upstream.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxy(request, (await context.params).path);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxy(request, (await context.params).path);
}
