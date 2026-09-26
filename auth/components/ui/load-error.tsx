"use client";

export function LoadError({ message, onRetry, busy = false }: {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p>{message}</p>
      <button type="button" disabled={busy} onClick={onRetry} className="mt-3 min-h-11 rounded-lg border border-rose-300 bg-white px-4 font-semibold hover:bg-rose-100 disabled:opacity-50">
        {busy ? "Загрузка…" : "Повторить загрузку"}
      </button>
    </div>
  );
}
