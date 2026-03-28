"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  progress?: number;
};

type AccessRequest = {
  id: string;
  courseId: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: string;
  course?: { title?: string };
};

function levelLabel(level: CourseItem["level"]) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

export default function StudentCoursesPage() {
  const [tab, setTab] = useState<"all" | "my" | "requests">("all");
  const [allCourses, setAllCourses] = useState<CourseItem[]>([]);
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCourseId, setBusyCourseId] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [allRes, myRes, reqRes] = await Promise.all([
        fetch(`${API_URL}/api/student/courses/discover`, {
          credentials: "include",
        }),
        fetch(`${API_URL}/api/student/courses`, { credentials: "include" }),
        fetch(`${API_URL}/api/student/course-access-requests`, {
          credentials: "include",
        }),
      ]);

      const allData = (await allRes.json()) as {
        courses?: CourseItem[];
        message?: string;
      };
      const myData = (await myRes.json()) as {
        courses?: CourseItem[];
        message?: string;
      };
      const reqData = (await reqRes.json()) as {
        requests?: AccessRequest[];
        message?: string;
      };

      if (!allRes.ok || !myRes.ok || !reqRes.ok) {
        setError(
          allData.message ??
            myData.message ??
            reqData.message ??
            "Не удалось загрузить курсы",
        );
        return;
      }

      setAllCourses(allData.courses ?? []);
      setMyCourses(myData.courses ?? []);
      setRequests(reqData.requests ?? []);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const requestStatusByCourseId = useMemo(() => {
    const map = new Map<string, AccessRequest["status"]>();
    for (const request of requests) {
      map.set(request.courseId, request.status);
    }
    return map;
  }, [requests]);

  const myCourseIds = useMemo(
    () => new Set(myCourses.map((item) => item.id)),
    [myCourses],
  );

  const requestAccess = async (courseId: string) => {
    setBusyCourseId(courseId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/student/course-access-requests`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ courseId }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось отправить заявку");
        return;
      }

      await loadData();
      setTab("requests");
    } catch {
      setError("Ошибка сети при отправке заявки");
    } finally {
      setBusyCourseId("");
    }
  };

  const renderStatusPill = (status: AccessRequest["status"] | "approved") => {
    if (status === "approved") {
      return (
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          Доступ открыт
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
          На рассмотрении
        </span>
      );
    }
    return (
      <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
        Отклонено
      </span>
    );
  };

  return (
    <main className="space-y-4">
      <section className="dashboard-rise relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-emerald-300/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Что делать сейчас
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Выберите курс и запросите доступ в 1 клик
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Начните с каталога, затем отслеживайте статус заявки во вкладке
            "Заявки".
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab("all")}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Открыть каталог
            </button>
            <button
              type="button"
              onClick={() => setTab("requests")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Мои заявки
            </button>
            <button
              type="button"
              onClick={() => setTab("my")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Мои курсы
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Курсы</h1>
        <p className="mt-1 text-sm text-slate-600">
          Единый доступ к каталогу, вашим курсам и заявкам.
        </p>

        <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={
              tab === "all"
                ? "rounded-lg bg-white px-3 py-1.5 shadow-sm"
                : "rounded-lg px-3 py-1.5 text-slate-600"
            }
          >
            Все курсы
          </button>
          <button
            type="button"
            onClick={() => setTab("my")}
            className={
              tab === "my"
                ? "rounded-lg bg-white px-3 py-1.5 shadow-sm"
                : "rounded-lg px-3 py-1.5 text-slate-600"
            }
          >
            Мои курсы
          </button>
          <button
            type="button"
            onClick={() => setTab("requests")}
            className={
              tab === "requests"
                ? "rounded-lg bg-white px-3 py-1.5 shadow-sm"
                : "rounded-lg px-3 py-1.5 text-slate-600"
            }
          >
            Заявки
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </section>

      {loading ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="h-5 w-3/4 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-full rounded bg-slate-100" />
              <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
              <div className="mt-4 h-8 w-1/2 rounded bg-slate-200" />
            </div>
          ))}
        </section>
      ) : null}

      {!loading && tab === "all" ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allCourses.length ? (
            allCourses.map((course) => {
              const own = myCourseIds.has(course.id);
              const requestStatus = requestStatusByCourseId.get(course.id);
              const status = own ? "approved" : requestStatus;

              return (
                <article
                  key={course.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {course.title}
                    </p>
                    {status ? renderStatusPill(status) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                    {course.description}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {course.category} · {levelLabel(course.level)}
                  </p>

                  {own ? (
                    <Link
                      href={`/dashboard/student/courses/${course.id}`}
                      className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Открыть курс
                    </Link>
                  ) : requestStatus === "pending" ? (
                    <p className="mt-3 text-xs font-semibold text-amber-700">
                      Заявка отправлена, ожидайте решения преподавателя.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={busyCourseId === course.id}
                      onClick={() => void requestAccess(course.id)}
                      className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      {busyCourseId === course.id
                        ? "Отправка..."
                        : requestStatus === "rejected"
                          ? "Запросить повторно"
                          : "Запросить доступ"}
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
              Каталог пока пуст. Обновите страницу позже или перейдите в "Мои
              курсы", если доступ уже выдан.
            </p>
          )}
        </section>
      ) : null}

      {!loading && tab === "my" ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myCourses.length ? (
            myCourses.map((course) => (
              <article
                key={course.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {course.title}
                  </p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    approved
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-slate-600">
                  {course.description}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, course.progress ?? 0))}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Прогресс: {course.progress ?? 0}%
                </p>
                <Link
                  href={`/dashboard/student/courses/${course.id}`}
                  className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Продолжить
                </Link>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
              <p>У вас пока нет одобренных курсов.</p>
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Перейти в каталог
              </button>
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === "requests" ? (
        <section className="space-y-2">
          {requests.length ? (
            requests.map((request) => (
              <article
                key={request.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {request.course?.title ?? `Курс ${request.courseId}`}
                  </p>
                  {renderStatusPill(request.status)}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {request.createdAt
                    ? `Отправлено: ${new Date(request.createdAt).toLocaleString("ru-RU")}`
                    : "Дата отправки недоступна"}
                </p>
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <p>Вы еще не отправляли заявки на доступ.</p>
              <button
                type="button"
                onClick={() => setTab("all")}
                className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Выбрать курс
              </button>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
