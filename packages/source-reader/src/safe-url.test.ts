import { describe, expect, it } from "vitest";
import { assertSafePublicUrl } from "./safe-url";

describe("assertSafePublicUrl", () => {
  it.each([
    "file:///etc/passwd",
    "gopher://127.0.0.1/",
    "http://user:secret@example.com/",
    "http://localhost/",
    "http://127.0.0.1/",
    "http://[::1]/",
    "http://example.com:8080/",
  ])("отклоняет небезопасный URL %s", async (url) => {
    await expect(assertSafePublicUrl(url)).rejects.toThrow();
  });
});
