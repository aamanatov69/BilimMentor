import { test } from "node:test";
import assert from "node:assert/strict";
import { attachmentValidationError } from "../lib/assignment-attachments.ts";
const mb = 1024 * 1024;
const file = (size) => ({ name: "answer.pdf", size });

test("accepts exact individual and total limits", () => {
  assert.equal(attachmentValidationError([file(8 * mb), file(8 * mb), file(4 * mb)]), "");
  assert.equal(attachmentValidationError([]), "");
});
test("rejects empty, invalid, oversized files and combined overflow", () => {
  for (const size of [0, -1, NaN, Infinity, 8 * mb + 1]) {
    assert.notEqual(attachmentValidationError([file(size)]), "");
  }
  assert.match(attachmentValidationError([file(8 * mb), file(8 * mb), file(4 * mb + 1)]), /20 МБ/);
});
