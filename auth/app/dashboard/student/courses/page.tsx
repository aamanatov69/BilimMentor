"use client";

import { apiFetch } from "@/lib/api-client";

import { StatusBadge } from "@/components/ui/status-badge";

import { EmptyState } from "@/components/ui/empty-state";

import { apiJson, apiErrorMessage } from "@/lib/api-client";

import Link from "next/link";
import { LoadError } from "@/components/ui/load-error";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

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
  return <Suspense fallback={<p role="status">Загрузка курсов…</p>}><StudentCoursesContent /></Suspense>;
}

function StudentCoursesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab === "all" || requestedTab === "requests" ? requestedTab : "my";
  const targetCourse = searchParams.get("course");
  const setTab = (value: "all" | "my" | "requests") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    params.delete("course");
    router.push(`/dashboard/student/courses?${params}`, { scroll: false });
  };
  const [allCourses, setAllCourses] = useState<CourseItem[]>([]);
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCourseId, setBusyCourseId] = useState("");

  const activeRequest = useRef<AbortController | null>(null);
  const loadData = async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");

    try {
      const [allData, myData, reqData] = await Promise.all([
        apiJson<{ courses?: CourseItem[] }>("/api/student/courses/discover", { signal: controller.signal }),
        apiJson<{ courses?: CourseItem[] }>("/api/student/courses", { signal: controller.signal }),
        apiJson<{ requests?: AccessRequest[] }>("/api/student/course-access-requests", { signal: controller.signal }),
      ]);
      if (controller.signal.aborted) return;
      setAllCourses(allData.courses ?? []);
      setMyCourses(myData.courses ?? []);
      setRequests(reqData.requests ?? []);
    } catch (error) {
      if (controller.signal.aborted) return;
      setError(apiErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    return () => activeRequest.current?.abort();
  }, []);

  useEffect(() => {
    if (loading || tab !== "all" || !targetCourse) return;
    const target = document.getElementById(`catalog-course-${targetCourse}`);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center" });
  }, [loading, tab, targetCourse]);

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
      const response = await apiFetch(
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

  const renderStatusPill = (status: AccessRequest["status"]) => <StatusBadge status={status} />;

  return (
    <main className="space-y-4">
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

        {error ? <LoadError message={error} busy={loading} onRetry={() => void loadData()} /> : null}
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

      {!loading && !error && tab === "all" ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allCourses.length ? (
            allCourses.map((course) => {
              const own = myCourseIds.has(course.id);
              const requestStatus = requestStatusByCourseId.get(course.id);
              const status = own ? "approved" : requestStatus;

              return (
                <article
                  key={course.id}
                  id={`catalog-course-${course.id}`}
                  tabIndex={-1}
                  aria-label={course.title}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${targetCourse === course.id ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"}`}
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
            <EmptyState className="sm:col-span-2 lg:col-span-3" title="Каталог пока пуст" description="Новые курсы появятся после публикации. Уже доступные вам материалы находятся в разделе «Мои курсы»." action={<button type="button" onClick={() => setTab("my")} className="min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold">Мои курсы</button>} />
          )}
        </section>
      ) : null}

      {!loading && !error && tab === "my" ? (
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
                  <StatusBadge status="approved" />
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
            <EmptyState className="sm:col-span-2 lg:col-span-3" title="У вас пока нет доступных курсов" description="Выберите курс в каталоге и отправьте заявку. Её состояние можно посмотреть во вкладке заявок." action={<button type="button" onClick={() => setTab("all")} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">Перейти в каталог</button>} />
          )}
        </section>
      ) : null}

      {!loading && !error && tab === "requests" ? (
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
