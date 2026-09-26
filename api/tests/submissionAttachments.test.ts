import { describe, expect, it, jest } from "@jest/globals";

jest.mock("../src/repositories/lmsRepository", () => ({ lmsRepository: {} }));
import { normalizeSubmissionInput } from "../src/services/shared/serviceHelpers";

const fallback = { text: "", formula: "", code: "", attachments: [] };

describe("submission attachment sizes", () => {
  it("rejects malformed attachments instead of silently dropping them", () => {
    for (const attachments of [null, {}, [null], [{}], [{ name: "answer.txt", dataBase64: "%%%" }], [{ name: "answer.txt", dataBase64: "YQ=" }], [{ name: "answer.txt", dataBase64: "YQ==", size: -1 }]]) {
      expect(() => normalizeSubmissionInput({ content: "Valid answer", attachments }, fallback)).toThrow();
    }
  });

  it("normalizes data URLs and whitespace and preserves omitted attachments", () => {
    const result = normalizeSubmissionInput({ attachments: [{ name: "answer.txt", dataBase64: "data:text/plain;base64,YQ==\n" }] }, fallback);
    expect(result.attachments[0].dataBase64).toBe("YQ==");
    expect(result.attachments[0].size).toBe(1);
    expect(normalizeSubmissionInput({ content: "Updated" }, result).attachments).toEqual(result.attachments);
    expect(normalizeSubmissionInput({ attachments: [] }, result).attachments).toEqual([]);
  });
  it("uses decoded bytes when the client understates the size", () => {
    const payload = normalizeSubmissionInput({ attachments: [
      { name: "answer.txt", size: 1, dataBase64: Buffer.from("answer").toString("base64") },
    ] }, fallback);
    expect(payload.attachments[0].size).toBe(6);
  });

  it("accounts for padding and retains larger declared sizes", () => {
    for (const content of ["a", "ab", "abc"]) {
      const dataBase64 = Buffer.from(content).toString("base64");
      const normalize = (size: number) => normalizeSubmissionInput({ attachments: [
        { name: "answer.txt", size, dataBase64 },
      ] }, fallback).attachments[0].size;
      expect(normalize(0)).toBe(content.length);
      expect(normalize(100)).toBe(100);
    }
  });
});
