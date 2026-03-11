"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function GradeSubmissionPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const submissionId = String(params.submissionId ?? "");
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/submissions/${submissionId}/grade`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ score: Number(score), feedback }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось сохранить оценку");
        return;
      }
      setMessage(data.message ?? "Оценка сохранена");
      setScore("");
      setFeedback("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">Оценить сдачу {submissionId}</h1>
      <p className="mt-2 text-slate-600">Курс: {id}</p>
      <input
        className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
        placeholder="Оценка"
        value={score}
        onChange={(event) => setScore(event.target.value)}
      />
      <textarea
        className="mt-3 min-h-24 w-full rounded border border-slate-300 px-3 py-2"
        placeholder="Комментарий (необязательно)"
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
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
          {loading ? "Сохранение..." : "Сохранить оценку"}
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
