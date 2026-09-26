import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { apiJson } from "../lib/api-client.ts";
const originalFetch = globalThis.fetch;
const originalBase = process.env.NEXT_PUBLIC_API_URL;
test("preserves cancellation while reading the response body", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  const controller = new AbortController();
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => {
    controller.abort();
    throw new DOMException("Aborted", "AbortError");
  } });
  await assert.rejects(apiJson("/api/me", { signal: controller.signal }), { name: "AbortError" });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = originalBase;
});

test("includes cookies and forwards cancellation", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000/";
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://localhost:4000/api/me");
    assert.equal(options.credentials, "include");
    controller.abort();
    assert.equal(options.signal.aborted, true);
    throw new DOMException("Aborted", "AbortError");
  };
  await assert.rejects(apiJson("/api/me", { signal: controller.signal }), { name: "AbortError" });
});

test("handles authorization, rate limits and server errors without retrying", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  for (const status of [401, 403, 413, 429, 503]) {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("upstream failure", { status }); };
    await assert.rejects(apiJson("/api/me"), { name: "ApiError", status });
    assert.equal(calls, 1);
  }
});

test("supports JSON and empty responses; rejects malformed JSON and missing configuration", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  globalThis.fetch = async () => Response.json({ ok: true });
  assert.deepEqual(await apiJson("/api/me"), { ok: true });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await apiJson("/api/me"), undefined);
  globalThis.fetch = async () => new Response("<html>error</html>");
  await assert.rejects(apiJson("/api/me"), { name: "ApiError" });
  delete process.env.NEXT_PUBLIC_API_URL;
  await assert.rejects(apiJson("/api/me"), { name: "ApiError" });
});

test("preserves the reason for a forbidden action with a fallback for missing messages", async () => {
  process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
  const message = "Срок сдачи задания прошёл.";
  globalThis.fetch = async () => Response.json({ message }, { status: 403 });
  await assert.rejects(apiJson("/api/student/assignments/one/submit"), { name: "ApiError", status: 403, message });
  for (const body of [{}, { message: " " }, { message: 42 }]) {
    globalThis.fetch = async () => Response.json(body, { status: 403 });
    await assert.rejects(apiJson("/api/me"), { status: 403, message: "Доступ запрещён. Возможно, права аккаунта изменились." });
  }
});
