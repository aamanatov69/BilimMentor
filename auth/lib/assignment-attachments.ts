// Keep aligned with the submission limits in api/src/services/shared/serviceHelpers.ts.
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_TOTAL_SIZE = 20 * 1024 * 1024;

export function attachmentValidationError(files: ReadonlyArray<{ name: string; size: number }>) {
  for (const file of files) {
    if (!Number.isFinite(file.size) || file.size <= 0) return `Файл «${file.name}» пуст или имеет некорректный размер.`;
    if (file.size > MAX_FILE_SIZE) return `Файл «${file.name}» превышает лимит 8 МБ.`;
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_SIZE) {
    return "Общий размер вложений превышает 20 МБ. Удалите лишние файлы.";
  }
  return "";
}
