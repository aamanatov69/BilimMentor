"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ToolItem = {
  id: string;
  title: string;
  desc: string;
  value: number | null;
};

export default function AdminSettingsPage() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [history, setHistory] = useState<
    Array<{
      id: string;
      action: "backup" | "restore";
      at: string;
      status: "success" | "error";
    }>
  >([]);

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/settings/overview`, {
        credentials: "include",
      });
      const data = (await response.json()) as {
        tools?: ToolItem[];
        generatedAt?: string;
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось загрузить настройки");
        return;
      }

      setTools(data.tools ?? []);
      setUpdatedAt(data.generatedAt ?? "");
    } catch {
      setError("Ошибка сети");
    }
  };

  useEffect(() => {
    void loadSettings();
    const persisted = window.localStorage.getItem("admin-system-history");
    if (persisted) {
      try {
        const parsed = JSON.parse(persisted) as Array<{
          id: string;
          action: "backup" | "restore";
          at: string;
          status: "success" | "error";
        }>;
        setHistory(parsed);
      } catch {
        // Ignore malformed history.
      }
    }
  }, []);

  const pushHistory = (entry: {
    action: "backup" | "restore";
    status: "success" | "error";
  }) => {
    setHistory((previous) => {
      const next = [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          action: entry.action,
          at: new Date().toISOString(),
          status: entry.status,
        },
        ...previous,
      ].slice(0, 20);

      window.localStorage.setItem("admin-system-history", JSON.stringify(next));
      return next;
    });
  };

  const runSystemAction = async (action: "backup" | "restore") => {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/admin/system/${action}`, {
        credentials: "include",
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось выполнить действие");
        pushHistory({ action, status: "error" });
        return;
      }
      setMessage(data.message ?? "Действие выполнено");
      pushHistory({ action, status: "success" });
      await loadSettings();
    } catch {
      setError("Ошибка сети");
      pushHistory({ action, status: "error" });
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Настройки</h1>
      <p className="mt-2 text-slate-600">
        Серверы и инструменты для административного управления.
      </p>
      {updatedAt ? (
        <p className="mt-1 text-xs text-slate-500">
          Обновлено: {new Date(updatedAt).toLocaleString()}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700">{message}</p>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {tools.map((item) => (
          <article
            key={item.id}
            className="rounded border border-slate-200 p-4"
          >
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
            {item.value !== null ? (
              <p className="mt-2 text-xl font-semibold text-blue-700">
                {item.value}
              </p>
            ) : null}
            <div className="mt-3 flex gap-3 text-sm">
              <Link
                href="/dashboard/admin/settings"
                className="text-blue-700 hover:underline"
              >
                Открыть
              </Link>
              {item.id === "backup" ? (
                <button
                  onClick={() => void runSystemAction("backup")}
                  className="text-blue-700 hover:underline"
                >
                  Запустить резервное копирование
                </button>
              ) : null}
              {item.id === "restore" ? (
                <button
                  onClick={() => void runSystemAction("restore")}
                  className="text-blue-700 hover:underline"
                >
                  Запустить восстановление
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          История backup/restore
        </h2>
        <div className="mt-3 space-y-2">
          {history.length ? (
            history.map((item) => (
              <article
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {item.action === "backup" ? "Backup" : "Restore"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.at).toLocaleString("ru-RU")}
                  </p>
                </div>
                <span
                  className={
                    item.status === "success"
                      ? "rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                      : "rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"
                  }
                >
                  {item.status === "success" ? "success" : "error"}
                </span>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              История операций пока пуста.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
