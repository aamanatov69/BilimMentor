"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseModule = Record<string, unknown>;

type CourseItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  modules?: CourseModule[];
};

type AccessRequest = {
  id: string;
  courseId: string;
  status: "pending" | "approved" | "rejected";
};

function getCourseLevelLabel(level: CourseItem["level"]) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function StudentCoursesPage() {
  const [allCourses, setAllCourses] = useState<CourseItem[]>([]);
  const [myCourses, setMyCourses] = useState<CourseItem[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [busyCourseId, setBusyCourseId] = useState("");
  const [pendingCourseIds, setPendingCourseIds] = useState<string[]>([]);

  const loadData = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setError("");

    try {
      const [allRes, myRes, reqRes] = await Promise.all([
        fetch(`${API_URL}/api/student/courses/discover`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/student/courses`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/student/course-access-requests`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          cache: "no-store",
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
      setPendingCourseIds((prev) => {
        const serverPending = new Set(
          (reqData.requests ?? [])
            .filter((item) => item.status === "pending")
            .map((item) => item.courseId),
        );
        const merged = new Set([...prev, ...serverPending]);
        return Array.from(merged);
      });
    } catch {
      setError("Ошибка сети при загрузке данных");
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const requestAccess = async (courseId: string) => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setBusyCourseId(courseId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/student/course-access-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ courseId }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось отправить заявку");
        return;
      }

      setPendingCourseIds((prev) =>
        prev.includes(courseId) ? prev : [...prev, courseId],
      );
      void loadData();
    } catch {
      setError("Ошибка сети при отправке заявки");
    } finally {
      setBusyCourseId("");
    }
  };

  const approvedIds = new Set(myCourses.map((course) => course.id));
  const latestStatusByCourse = new Map<string, AccessRequest["status"]>();
  requests.forEach((item) =>
    latestStatusByCourse.set(item.courseId, item.status),
  );

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold">Курсы студента</h1>
        <p className="mt-2 text-slate-600">
          Доступ к курсу открывается только после одобрения преподавателем.
        </p>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Мои доступные курсы</h2>
        {myCourses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Пока нет одобренных курсов.
          </p>
        ) : (
          <div className="mt-3 flex max-h-[29rem] flex-col gap-3 overflow-y-auto pr-1">
            {myCourses.map((course) => (
              <article
                key={course.id}
                className="rounded border border-slate-200 p-4"
              >
                <p className="break-words font-medium">{course.title}</p>
                <p className="mt-1 break-words text-sm text-slate-600">
                  {course.description}
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Доступ разрешен преподавателем
                </p>
                <Link
                  href={`/dashboard/student/courses/${course.id}`}
                  className="mt-3 inline-block w-full rounded bg-blue-700 px-3 py-2 text-center text-xs text-white hover:bg-blue-800 sm:w-auto"
                >
                  Просмотреть курс
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Каталог курсов</h2>
        {allCourses.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Каталог пока пуст.</p>
        ) : (
          <div className="mt-3 flex max-h-[29rem] flex-col gap-3 overflow-y-auto pr-1">
            {allCourses.map((course) => {
              const status = latestStatusByCourse.get(course.id);
              const hasAccess = approvedIds.has(course.id);
              const isPending =
                status === "pending" || pendingCourseIds.includes(course.id);

              return (
                <article
                  key={course.id}
                  className="rounded border border-slate-200 p-4"
                >
                  <p className="break-words font-medium">{course.title}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {course.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {course.category} • {getCourseLevelLabel(course.level)}
                  </p>

                  <div className="mt-3">
                    {hasAccess ? (
                      <span className="text-xs font-medium text-emerald-700">
                        Доступ одобрен
                      </span>
                    ) : isPending ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />В
                        ожидании
                      </span>
                    ) : status === "rejected" ? (
                      <button
                        className="w-full rounded bg-blue-700 px-3 py-2 text-xs text-white hover:bg-blue-800 sm:w-auto"
                        onClick={() => void requestAccess(course.id)}
                        disabled={busyCourseId === course.id}
                      >
                        {busyCourseId === course.id
                          ? "Отправка..."
                          : "Запросить доступ повторно"}
                      </button>
                    ) : (
                      <button
                        className="w-full rounded bg-blue-700 px-3 py-2 text-xs text-white hover:bg-blue-800 sm:w-auto"
                        onClick={() => void requestAccess(course.id)}
                        disabled={busyCourseId === course.id}
                      >
                        {busyCourseId === course.id
                          ? "Отправка..."
                          : "Запросить доступ"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
