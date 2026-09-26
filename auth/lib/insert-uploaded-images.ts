export function insertUploadedImages(latest: string, original: string, start: number, end: number, urls: string[]) {
  const insertion = `\n${urls.map((url) => `![image](${url})`).join("\n\n")}\n`;
  // Only replace the original selection if the answer has not changed during upload.
  return latest === original
    ? latest.slice(0, start) + insertion + latest.slice(end)
    : latest + insertion;
}
