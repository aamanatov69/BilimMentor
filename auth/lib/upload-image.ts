import sharp from "sharp";

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_INPUT_PIXELS = 24_000_000;
const mimeByFormat: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function sanitizeUploadImage(bytes: Buffer, declaredMime: string) {
  if (!bytes.length || bytes.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Размер изображения должен быть до 10 МБ");
  }
  if (!Object.values(mimeByFormat).includes(declaredMime.toLowerCase())) {
    throw new Error("Поддерживаются PNG, JPEG, WebP и GIF");
  }
  const input = sharp(bytes, {
    animated: true,
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: "warning",
  });
  const metadata = await input.metadata();
  if (!metadata.format || mimeByFormat[metadata.format] !== declaredMime.toLowerCase()) {
    throw new Error("Содержимое файла не соответствует формату изображения");
  }
  // Decode all frames and re-encode: never serve the original uploaded bytes.
  const output = await input.rotate().webp({ lossless: true }).toBuffer();
  if (output.length > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("Изображение после обработки превышает 10 МБ");
  }
  return output;
}
