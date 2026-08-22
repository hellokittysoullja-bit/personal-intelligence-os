import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const ALLOWED_PORTS = new Set(["", "80", "443"]);

function isUnsafeIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) || a >= 224;
}

function isUnsafeIp(value: string): boolean {
  const family = isIP(value);
  if (family === 4) return isUnsafeIpv4(value);
  if (family !== 6) return true;
  const normalized = value.toLowerCase();
  if (normalized === "::" || normalized === "::1" || normalized.startsWith("fe80:") ||
      normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("ff")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isUnsafeIpv4(mapped[1] ?? "") : false;
}

export async function assertSafePublicUrl(input: string): Promise<URL> {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only HTTP/S source URLs are allowed");
  if (url.username || url.password) throw new Error("Source URLs with credentials are not allowed");
  if (!ALLOWED_PORTS.has(url.port)) throw new Error("Only ports 80 and 443 are allowed");
  if (url.hostname.toLowerCase() === "localhost") throw new Error("Localhost is not allowed");

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((item) => isUnsafeIp(item.address))) {
    throw new Error("Source URL must resolve only to public IP addresses");
  }
  return url;
}
