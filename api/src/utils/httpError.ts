export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ensure(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) {
    throw new HttpError(status, message);
  }
}
