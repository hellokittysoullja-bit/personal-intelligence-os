import { assertSafePublicUrl } from "./safe-url";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 1_000_000;

export interface PublicTextSource {
  requestedUrl: string;
  finalUrl: string;
  contentType: string;
  body: string;
  retrievedAt: string;
}

function assertTextContentType(contentType: string): void {
  const normalized = contentType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  if (!new Set(["text/html", "text/plain", "application/xhtml+xml"]).has(normalized)) {
    throw new Error("Only HTML and plain-text sources are allowed");
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw new Error("Source body exceeds the size limit");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Source body exceeds the size limit");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(result);
}

/**
 * Public text collector. Redirects are intentionally rejected rather than
 * followed, so every later redirect policy can be implemented as a fresh safe
 * URL validation step.
 */
export async function readPublicTextSource(
  sourceUrl: string,
  options: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<PublicTextSource> {
  const url = await assertSafePublicUrl(sourceUrl);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    headers: { accept: "text/html, text/plain, application/xhtml+xml;q=0.9" },
  });
  if (response.status >= 300 && response.status < 400) throw new Error("Redirect responses are not allowed");
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  assertTextContentType(contentType);
  const body = await readBoundedBody(response, options.maxBytes ?? DEFAULT_MAX_BYTES);
  return {
    requestedUrl: sourceUrl,
    finalUrl: response.url,
    contentType,
    body,
    retrievedAt: new Date().toISOString(),
  };
}
