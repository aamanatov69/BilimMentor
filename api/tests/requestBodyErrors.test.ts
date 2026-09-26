import { describe, expect, it } from "@jest/globals";
import express from "express";
import request from "supertest";
import { errorHandler } from "../src/middleware/errorHandler";

const app = express();
app.use(express.json({ limit: "1kb" }));
app.post("/answer", (_req, res) => { res.json({ ok: true }); });
app.use(errorHandler);

describe("request body errors", () => {
  it("returns 400 without echoing malformed request content", async () => {
    const response = await request(app).post("/answer")
      .set("Content-Type", "application/json").send('{"privateAnswer":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Некорректный формат JSON в запросе." });
  });

  it("returns an actionable 413 for oversized bodies", async () => {
    const response = await request(app).post("/answer").send({ content: "a".repeat(2048) });
    expect(response.status).toBe(413);
    expect(response.body.message).toContain("Уменьшите размер");
  });

  it("accepts a valid body within the limit", async () => {
    const response = await request(app).post("/answer").send({ content: "answer" });
    expect(response.status).toBe(200);
  });
});
