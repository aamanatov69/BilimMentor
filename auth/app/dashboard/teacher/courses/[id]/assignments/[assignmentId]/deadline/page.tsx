"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function ChangeDeadlinePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const assignmentId = String(params.assignmentId ?? "");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/assignments/${assignmentId}/deadline`, {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ dueAt }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось обновить дедлайн");
        return;
      }
      setMessage(data.message ?? "Дедлайн обновлен");
      setDueAt("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">Изменить дедлайн</h1>
      <p className="mt-2 text-slate-600">
        Курс: {id} • Задание: {assignmentId}
      </p>
      <input
        className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
        placeholder="Новый дедлайн"
        value={dueAt}
        onChange={(event) => setDueAt(event.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
        >
          {loading ? "Сохранение..." : "Сохранить"}
        </button>
        <Link
          href={`/dashboard/teacher/courses/${id}`}
          className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Назад
        </Link>
      </div>
    </main>
  );
}
