export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

// Response-based adapter for existing screens, including file downloads.
// Buffer the body inside the timeout so a stalled download cannot leave a form busy forever.
export async function apiFetch(input: string, options: RequestInit = {}): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) throw new ApiError("Не настроен адрес API");
  const path = input.startsWith(`${base}/`) ? input.slice(base.length) : input;
  if (!(path.startsWith("/api/") || path === "/health" || path === "/ready") || path.includes("\\") || path.includes("..")) {
    throw new ApiError("Некорректный адрес API");
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
  try {
    const response = await fetch(`${base}${path}`, { ...options, credentials: "include", signal: controller.signal });
    const messages: Record<number, string> = {
      401: "Сессия истекла. Войдите в аккаунт снова.",
      413: "Запрос слишком большой. Уменьшите размер вложений или текста ответа.",
      429: "Слишком много запросов. Повторите немного позже.",
    };
    if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event("bilimmentor:session-expired"));
    }
    const message = messages[response.status] ?? (response.status >= 500 ? "Сервис временно недоступен. Повторите запрос позже." : "");
    if (message) {
      await response.body?.cancel();
      return Response.json({ message }, { status: response.status });
    }
    const body = await response.arrayBuffer();
    return new Response(response.status === 204 || response.status === 205 ? null : body, {
      status: response.status, statusText: response.statusText, headers: response.headers,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timedOut) throw new ApiError("Сервер отвечает слишком долго. Повторите запрос.");
    if (error instanceof ApiError) throw error;
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение и повторите запрос.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) throw new ApiError("Не настроен адрес API");
  if (!path.startsWith("/api/") || path.includes("\\")) throw new ApiError("Некорректный адрес API");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
  try {
    const response = await fetch(`${base}${path}`, { ...options, credentials: "include", signal: controller.signal });
    if (response.status === 401) {
      if (typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
        window.dispatchEvent(new Event("bilimmentor:session-expired"));
      }
      throw new ApiError(path === "/api/auth/login" ? "Неверный логин или пароль." : "Сессия истекла. Войдите в аккаунт снова.", 401);
    }
    if (response.status === 413) throw new ApiError("Запрос слишком большой. Уменьшите размер вложений или текста ответа.", 413);
    if (response.status === 429) throw new ApiError("Слишком много запросов. Повторите немного позже.", 429);
    if (response.status >= 500) throw new ApiError("Сервис временно недоступен. Повторите запрос позже.", response.status);
    if (response.status === 204 && response.ok) return undefined as T;
    let data: unknown;
    try { data = await response.json(); } catch (error) {
      if (controller.signal.aborted) throw error;
      if (response.status === 403) throw new ApiError("Доступ запрещён. Возможно, права аккаунта изменились.", 403);
      throw new ApiError("Сервер вернул некорректный ответ. Повторите запрос.", response.status);
    }
    if (!response.ok) {
      const fallback = response.status === 403 ? "Доступ запрещён. Возможно, права аккаунта изменились." : "Не удалось выполнить запрос";
      const message = data && typeof data === "object" && "message" in data && typeof data.message === "string" && data.message.trim() ? data.message : fallback;
      throw new ApiError(message, response.status);
    }
    return data as T;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (timedOut) throw new ApiError("Сервер отвечает слишком долго. Повторите запрос.");
    if (error instanceof ApiError) throw error;
    throw new ApiError("Не удалось связаться с сервером. Проверьте подключение и повторите запрос.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
