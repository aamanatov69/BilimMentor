import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { sanitizeUploadImage, MAX_UPLOAD_SIZE_BYTES } from "../lib/upload-image.ts";

const pixels = { create: { width: 4, height: 4, channels: 4, background: "#0099ff" } };

test("supported images are decoded and converted to WebP", async () => {
  for (const [format, mime] of [["png", "image/png"], ["jpeg", "image/jpeg"], ["gif", "image/gif"], ["webp", "image/webp"]]) {
    const original = await sharp(pixels).toFormat(format).toBuffer();
    const output = await sanitizeUploadImage(original, mime);
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 4);
    assert.equal(metadata.height, 4);
  }
});

test("rejects fake MIME, vectors, mismatched formats and corrupt content", async () => {
  const png = await sharp(pixels).png().toBuffer();
  await assert.rejects(() => sanitizeUploadImage(Buffer.from("<script>alert(1)</script>"), "image/png"));
  await assert.rejects(() => sanitizeUploadImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/svg+xml"));
  await assert.rejects(() => sanitizeUploadImage(png, "image/jpeg"));
  await assert.rejects(() => sanitizeUploadImage(png.subarray(0, 35), "image/png"));
});

test("rejects oversized bytes and decoded dimensions", async () => {
  await assert.rejects(() => sanitizeUploadImage(Buffer.alloc(MAX_UPLOAD_SIZE_BYTES + 1), "image/png"));
  const large = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(() => sanitizeUploadImage(large, "image/png"));
});
