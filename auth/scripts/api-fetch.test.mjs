import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiFetch } from "../lib/api-client.ts";
const originalFetch = globalThis.fetch;
const originalBase = process.env.NEXT_PUBLIC_API_URL;
afterEach(() => { globalThis.fetch = originalFetch; if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_URL; else process.env.NEXT_PUBLIC_API_URL = originalBase; });

test("preserves JSON errors and file bodies and includes cookies", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:4000/api/file");
    assert.equal(options.credentials, "include");
    return new Response(new Uint8Array([0, 255, 12]), { headers: { "content-type": "application/octet-stream" } });
  };
  assert.deepEqual(new Uint8Array(await (await apiFetch("http://localhost:4000/api/file")).arrayBuffer()), new Uint8Array([0, 255, 12]));
  globalThis.fetch = async () => Response.json({ message: "Deadline passed" }, { status: 403 });
  const result = await apiFetch("/api/file");
  assert.equal(result.status, 403);
  assert.deepEqual(await result.json(), { message: "Deadline passed" });
});
test("normalizes upstream failures without retries", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  for (const status of [401, 413, 429, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("<html>Failure</html>", { status }); };
    const response = await apiFetch("/api/file");
    assert.equal(response.status, status);
    assert.equal(typeof (await response.json()).message, "string");
    assert.equal(calls, 1);
  }
});
test("keeps cancellation active while reading the body and rejects foreign URLs", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  const controller = new AbortController();
  globalThis.fetch = async () => ({ status: 200, arrayBuffer: async () => { controller.abort(); throw new DOMException("Aborted", "AbortError"); } });
  await assert.rejects(apiFetch("/api/file", { signal: controller.signal }), { name: "AbortError" });
  await assert.rejects(apiFetch("https://other.test/api/file"), { name: "ApiError" });
});
