"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type StudentOverview = {
  summary: {
    courses: number;
    assignments: number;
    dueSoon: boolean;
    gpa: number;
  };
  currentCourses: {
    id: string;
    name: string;
    teacher: string;
    status: string;
    progress: number;
  }[];
  assignments: {
    id: string;
    title: string;
    course: string;
    dueDate: string | null;
    status: string;
    dueSoon: boolean;
  }[];
  recentGrades: {
    id: string;
    assignment: string;
    course: string;
    grade: number | null;
    comment: string | null;
    createdAt: string;
  }[];
};

function daysLeft(dateRaw: string | null) {
  if (!dateRaw) return null;
  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function StudentDashboardPage() {
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseFilter, setCourseFilter] = useState<"active" | "completed">(
    "active",
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/api/student/overview`, {
          credentials: "include",
        });

        const data = (await response.json()) as StudentOverview & {
          message?: string;
        };

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить дашборд");
          return;
        }

        setOverview(data);
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const courseRows = useMemo(() => {
    const rows = overview?.currentCourses ?? [];
    if (courseFilter === "completed") {
      return rows.filter((item) => item.progress >= 100);
    }
    return rows.filter((item) => item.progress < 100);
  }, [overview?.currentCourses, courseFilter]);

  const dueSoonRows = useMemo(() => {
    return (overview?.assignments ?? [])
      .filter((item) => item.dueSoon || item.status !== "Enabled")
      .slice(0, 6);
  }, [overview?.assignments]);

  const latestGrades = (overview?.recentGrades ?? []).slice(0, 6);

  const gpaPercent = Math.max(
    0,
    Math.min(100, ((overview?.summary.gpa ?? 0) / 4) * 100),
  );

  return (
    <main className="space-y-6">
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Курсы</h2>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCourseFilter("active")}
                className={
                  courseFilter === "active"
                    ? "rounded-lg bg-white px-3 py-1 text-slate-900 shadow-sm"
                    : "rounded-lg px-3 py-1 text-slate-600"
                }
              >
                Активные
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter("completed")}
                className={
                  courseFilter === "completed"
                    ? "rounded-lg bg-white px-3 py-1 text-slate-900 shadow-sm"
                    : "rounded-lg px-3 py-1 text-slate-600"
                }
              >
                Завершенные
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {courseRows.length ? (
              courseRows.map((course) => (
                <article
                  key={course.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {course.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {course.teacher}
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900"
                      style={{
                        width: `${Math.max(0, Math.min(100, course.progress))}%`,
                      }}
                    />
                  </div>
                  <Link
                    href={`/dashboard/student/courses/${course.id}`}
                    className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Перейти к курсу
                  </Link>
                </article>
              ))
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 sm:col-span-2">
                Для выбранного фильтра пока нет курсов. Переключите вкладку или
                откройте каталог курсов.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Дедлайны</h2>
          <div className="mt-4 space-y-2">
            {dueSoonRows.length ? (
              dueSoonRows.map((item) => {
                const left = daysLeft(item.dueDate);
                const urgent = left !== null && left <= 2;
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {item.course}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={
                          urgent
                            ? "rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700"
                            : "rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700"
                        }
                      >
                        {left === null
                          ? "Дата не указана"
                          : left < 0
                            ? "Просрочено"
                            : `${left} дн.`}
                      </span>
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={
                            urgent
                              ? "h-full bg-rose-500"
                              : "h-full bg-amber-500"
                          }
                          style={{
                            width: `${left === null ? 35 : Math.max(8, Math.min(100, 100 - left * 8))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Срочных дедлайнов нет. Отличный момент продвинуться в текущем
                курсе.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            GPA и динамика
          </h2>
          <p className="mt-3 text-4xl font-bold text-slate-900">
            {(overview?.summary.gpa ?? 0).toFixed(2)}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500"
              style={{ width: `${gpaPercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">Шкала 0-4</p>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Последние оценки
          </h2>
          <div className="mt-4 space-y-2">
            {latestGrades.length ? (
              latestGrades.map((grade) => (
                <div
                  key={grade.id}
                  className="rounded-2xl border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {grade.assignment}
                    </p>
                    <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold text-white">
                      {grade.grade ?? "-"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{grade.course}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(grade.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Пока нет оценок. Сдайте первое задание, чтобы увидеть прогресс.
              </p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
