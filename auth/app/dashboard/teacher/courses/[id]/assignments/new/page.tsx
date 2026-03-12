"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type LessonOption = {
  id: string;
  title: string;
};

export default function NewAssignmentPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadLessons = async () => {

      try {
        const response = await fetch(
          `${API_URL}/api/teacher/courses/${id}/details`, {
          credentials: "include",
          },
        );

        const data = (await response.json()) as {
          message?: string;
          course?: { modules?: Array<Record<string, unknown>> };
        };

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить уроки");
          return;
        }

        const nextLessons = (
          Array.isArray(data.course?.modules) ? data.course?.modules : []
        )
          .filter(
            (item) =>
              typeof item === "object" &&
              item !== null &&
              String(
                (item as Record<string, unknown>).type ?? "",
              ).toLowerCase() === "lesson",
          )
          .map((item) => {
            const record = item as Record<string, unknown>;
            return {
              id: String(record.id ?? ""),
              title: String(record.title ?? "Без названия"),
            };
          })
          .filter((item) => item.id);

        setLessons(nextLessons);
        setLessonId((prev) => prev || nextLessons[0]?.id || "");
      } catch {
        setError("Ошибка сети");
      }
    };

    if (id) {
      void loadLessons();
    }
  }, [id]);

  const create = async () => {

    setLoading(true);
    setError("");
    setMessage("");

    if (!lessonId) {
      setError("Выберите урок для задания");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/assignments`, {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title, description, dueAt, lessonId }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось создать задание");
        return;
      }
      setMessage(data.message ?? "Задание создано");
      setTitle("");
      setDescription("");
      setDueAt("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">Создать задание</h1>
      <p className="mt-2 text-slate-600">Курс: {id}</p>
      <form className="mt-4 grid gap-3">
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Название задания"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="min-h-28 rounded border border-slate-300 px-3 py-2"
          placeholder="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <select
          className="rounded border border-slate-300 px-3 py-2"
          value={lessonId}
          onChange={(event) => setLessonId(event.target.value)}
        >
          <option value="">Выберите урок</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-slate-300 px-3 py-2"
          placeholder="Дедлайн"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void create()}
            disabled={loading}
            className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
          >
            {loading ? "Создание..." : "Создать"}
          </button>
          <Link
            href={`/dashboard/teacher/courses/${id}`}
            className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
          >
            Назад
          </Link>
        </div>
      </form>
    </main>
  );
}
