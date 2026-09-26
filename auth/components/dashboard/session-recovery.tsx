"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiJson, apiErrorMessage } from "@/lib/api-client";

export function SessionRecovery({ userId }: { userId: string }) {
  const [expired, setExpired] = useState(false);
  const [open, setOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const expire = () => { setExpired(true); setRestored(false); };
    window.addEventListener("bilimmentor:session-expired", expire);
    return () => window.removeEventListener("bilimmentor:session-expired", expire);
  }, []);
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (focus instanceof HTMLElement && focus.isConnected) focus.focus();
    };
  }, [open]);
  const close = () => { setOpen(false); setPassword(""); setError(""); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, expectedUserId: userId }),
      });
      setExpired(false);
      setRestored(true);
      close();
    } catch (error) { setError(apiErrorMessage(error)); }
    finally { setBusy(false); setPassword(""); }
  };
  return <>
    {restored ? <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">Вход восстановлен. Введённые данные остались на странице. Повторите нужное действие.</p> : null}
    {expired ? <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p>Сессия истекла. Не закрывайте страницу с неотправленными данными.</p>
      {userId ? <button type="button" onClick={() => setOpen(true)} className="mt-2 min-h-11 rounded-lg border border-amber-400 bg-white px-4 font-semibold">Войти без закрытия формы</button>
        : <a href="/login" target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center underline">Открыть вход в новой вкладке</a>}
    </div> : null}
    <dialog ref={dialogRef} aria-labelledby="session-recovery-title" onCancel={(event) => { event.preventDefault(); if (!busy) close(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-5 backdrop:bg-slate-950/50">
      <form onSubmit={submit} className="space-y-4">
        <h2 id="session-recovery-title" className="text-lg font-semibold">Восстановить вход</h2>
        <p className="text-sm text-slate-600">Войдите в тот же аккаунт. Страница и введённые данные сохранятся.</p>
        <label className="block text-sm">Почта или телефон<input autoComplete="username" required value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-1 block min-h-11 w-full rounded border p-2" /></label>
        <label className="block text-sm">Пароль<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block min-h-11 w-full rounded border p-2" /></label>
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex gap-3"><button disabled={busy} className="min-h-11 rounded bg-blue-700 px-4 text-white disabled:opacity-50">{busy ? "Вход…" : "Войти"}</button><button type="button" disabled={busy} onClick={close} className="min-h-11 rounded border px-4">Отмена</button></div>
      </form>
    </dialog>
  </>;
}
