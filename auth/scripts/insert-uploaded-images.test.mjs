import { test } from "node:test";
import assert from "node:assert/strict";
import { insertUploadedImages } from "../lib/insert-uploaded-images.ts";

test("replaces the selected text when the answer has not changed", () => {
  assert.equal(insertUploadedImages("abc", "abc", 1, 2, ["/uploads/a.webp"]), "a\n![image](/uploads/a.webp)\nc");
});

test("preserves edits and previously inserted images while an upload is pending", () => {
  const latest = "New answer typed during upload";
  const first = insertUploadedImages(latest, "old answer", 0, 10, ["/uploads/a.webp"]);
  const second = insertUploadedImages(first, "old answer", 0, 10, ["/uploads/b.webp"]);
  assert.equal(second, `${latest}\n![image](/uploads/a.webp)\n\n![image](/uploads/b.webp)\n`);
  assert.equal(insertUploadedImages("", "old answer", 0, 10, ["/uploads/a.webp"]), "\n![image](/uploads/a.webp)\n");
});
