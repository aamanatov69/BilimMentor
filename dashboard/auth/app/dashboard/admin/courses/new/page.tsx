"use client";

import { type FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function AdminNewCoursePage() {
  const [title, setTitle] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/admin/courses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          teacher_id: teacherId,
          description,
          category: "General",
          level: "beginner",
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        course?: { id: string };
      };
      if (!response.ok) {
        setError(data.message ?? "Не удалось создать курс");
        return;
      }
      setMessage(`Курс создан: ${data.course?.id ?? "OK"}`);
      setTitle("");
      setTeacherId("");
      setDescription("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">Создать курс</h1>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {message ? (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      ) : null}
      <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Название курса"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="ID преподавателя (например u2)"
          value={teacherId}
          onChange={(event) => setTeacherId(event.target.value)}
          required
        />
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-fit rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
        >
          {loading ? "Создание..." : "Создать курс"}
        </button>
      </form>
    </main>
  );
}
