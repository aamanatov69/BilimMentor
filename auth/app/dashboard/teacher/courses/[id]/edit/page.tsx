"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseLevel = "beginner" | "intermediate" | "advanced";

type TeacherCourseDetailsResponse = {
  course?: {
    title?: string;
    description?: string;
    level?: CourseLevel;
  };
  message?: string;
};

function getCourseLevelLabel(level: CourseLevel) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

export default function TeacherCourseEditPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<CourseLevel>("beginner");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    const loadCourse = async () => {

      setLoadingInitial(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/teacher/courses/${id}/details`, {
          credentials: "include",
          },
        );

        const data = (await response.json()) as TeacherCourseDetailsResponse;

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить курс");
          return;
        }

        setTitle(data.course?.title ?? "");
        setDescription(data.course?.description ?? "");
        setLevel(data.course?.level ?? "beginner");
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoadingInitial(false);
      }
    };

    void loadCourse();
  }, [id]);

  const save = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/teacher/courses/${id}`, {
          credentials: "include",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description, level }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось сохранить курс");
        return;
      }
      setMessage(data.message ?? "Курс обновлен");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">Редактирование курса: {id}</h1>
      <form className="mt-4 grid gap-3">
        {loadingInitial ? (
          <p className="text-sm text-slate-600">Загрузка данных курса...</p>
        ) : null}

        <input
          className="rounded border border-slate-300 px-3 py-2"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Название"
        />
        <label className="text-sm font-medium text-slate-700">Уровень</label>
        <select
          className="rounded border border-slate-300 px-3 py-2"
          value={level}
          onChange={(event) => setLevel(event.target.value as CourseLevel)}
        >
          <option value="beginner">{getCourseLevelLabel("beginner")}</option>
          <option value="intermediate">
            {getCourseLevelLabel("intermediate")}
          </option>
          <option value="advanced">{getCourseLevelLabel("advanced")}</option>
        </select>
        <textarea
          className="min-h-28 rounded border border-slate-300 px-3 py-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Описание"
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <div className="flex gap-2">
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
      </form>
    </main>
  );
}
