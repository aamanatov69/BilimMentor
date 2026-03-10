"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type StudentRole = "student";

interface StudentUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: StudentRole;
}

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
  announcements: {
    id: string;
    title: string;
    text: string;
    date: string;
  }[];
};

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getTokenFromCookie();
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadData = async () => {
      try {
        const [meRes, overviewRes] = await Promise.all([
          fetch(`${API_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/student/overview`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const meData = (await meRes.json()) as {
          user?: StudentUser;
          message?: string;
        };
        const overviewData = (await overviewRes.json()) as StudentOverview & {
          message?: string;
        };

        if (!meRes.ok || !meData.user || meData.user.role !== "student") {
          router.replace("/login");
          return;
        }

        if (!overviewRes.ok) {
          setError(
            overviewData.message ?? "Не удалось загрузить данные дашборда",
          );
        } else {
          setOverview(overviewData);
        }

        setUser(meData.user);
      } catch {
        router.replace("/login");
      }
    };

    void loadData();
  }, [router]);

  const displayName = user?.fullName?.split(" ")[0] ?? "Студент";

  const dueSoon = overview?.summary.dueSoon ?? false;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Добро пожаловать, {displayName}!
        </h1>
        <p className="mt-2 text-slate-600">
          Краткая информация о вашем учебном процессе.
        </p>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Мои курсы</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">
            {overview?.summary.courses ?? 0}
          </p>
          <Link
            href="/dashboard/student/courses"
            className="mt-2 inline-block text-sm text-blue-700 hover:underline"
          >
            Открыть список курсов
          </Link>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Задания к сдаче</p>
          <p
            className={
              dueSoon
                ? "mt-2 text-3xl font-semibold text-rose-600"
                : "mt-2 text-3xl font-semibold text-slate-800"
            }
          >
            {overview?.summary.assignments ?? 0}
          </p>
          <p
            className={
              dueSoon
                ? "mt-2 text-sm text-rose-600"
                : "mt-2 text-sm text-slate-600"
            }
          >
            {dueSoon ? "Скоро дедлайн" : "Дедлайны под контролем"}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Средний балл (GPA)</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600">
            {overview?.summary.gpa ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-600">Средний балл</p>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Текущие курсы</h2>
          <div
            className={
              (overview?.currentCourses ?? []).length > 4
                ? "mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm"
                : "mt-4 space-y-3 text-sm"
            }
          >
            {(overview?.currentCourses ?? []).length ? (
              (overview?.currentCourses ?? []).map((course) => (
                <div
                  key={course.id}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <p className="break-words font-medium">{course.name}</p>
                  <p className="text-xs text-slate-500">
                    Преподаватель: {course.teacher}
                  </p>
                  <p className="text-xs text-slate-600">
                    Статус: {course.status}
                  </p>
                  <p className="text-xs text-slate-600">
                    Прогресс: {course.progress}%
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-600"
                      style={{
                        width: `${Math.max(0, Math.min(100, course.progress))}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                У вас пока нет активных курсов.
              </p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Задания к сдаче</h2>
          <div
            className={
              (overview?.assignments ?? []).length > 4
                ? "mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm"
                : "mt-4 space-y-3 text-sm"
            }
          >
            {(overview?.assignments ?? []).length ? (
              (overview?.assignments ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <p className="break-words font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">Курс: {item.course}</p>
                  <p className="text-xs text-slate-600">
                    Дата сдачи:{" "}
                    {item.dueDate
                      ? new Date(item.dueDate).toLocaleDateString()
                      : "Не указана"}
                  </p>
                  <p className="text-xs text-slate-600">
                    Статус: {item.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Нет активных заданий.</p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Последние оценки</h2>
          <div
            className={
              (overview?.recentGrades ?? []).length > 4
                ? "mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm"
                : "mt-4 space-y-3 text-sm"
            }
          >
            {(overview?.recentGrades ?? []).length ? (
              (overview?.recentGrades ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <p className="break-words font-medium">{item.assignment}</p>
                  <p className="text-xs text-slate-500">Курс: {item.course}</p>
                  <p className="text-xs text-slate-700">
                    Оценка: {item.grade ?? "Не оценено"}
                  </p>
                  <p className="break-words text-xs text-slate-600">
                    Комментарий: {item.comment ?? "-"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Оценки пока отсутствуют.</p>
            )}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Объявления</h2>
          <div
            className={
              (overview?.announcements ?? []).length > 4
                ? "mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 text-sm"
                : "mt-4 space-y-3 text-sm"
            }
          >
            {(overview?.announcements ?? []).length ? (
              (overview?.announcements ?? []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <p className="break-words font-medium">{item.title}</p>
                  <p className="break-words text-xs text-slate-600">
                    {item.text}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.date).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                Новых объявлений пока нет.
              </p>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
