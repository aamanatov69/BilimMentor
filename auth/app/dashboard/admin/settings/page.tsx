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

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function AdminSettingsPage() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tools, setTools] = useState<ToolItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const loadSettings = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/settings/overview`, {
        headers: { Authorization: `Bearer ${token}` },
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
  }, []);

  const runSystemAction = async (action: "backup" | "restore") => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/admin/system/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось выполнить действие");
        return;
      }
      setMessage(data.message ?? "Действие выполнено");
      await loadSettings();
    } catch {
      setError("Ошибка сети");
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
    </main>
  );
}
