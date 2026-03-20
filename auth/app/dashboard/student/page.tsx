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

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StudentUser | null>(null);
  const [overview, setOverview] = useState<StudentOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [meRes, overviewRes] = await Promise.all([
          fetch(`${API_URL}/api/me`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/student/overview`, {
            credentials: "include",
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

  const currentCourses = overview?.currentCourses ?? [];
  const assignments = overview?.assignments ?? [];
  const recentGrades = overview?.recentGrades ?? [];
  const announcements = overview?.announcements ?? [];

  return (
    <main className="space-y-3 lg:space-y-4">
      <h1 className="text-xl font-bold leading-none text-slate-900 sm:text-2xl lg:text-[38px]">
        Рабочий стол
      </h1>

      <section className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg lg:text-2xl">
          Добро пожаловать, {displayName}!
        </h2>
        <p className="mt-1 text-sm text-slate-600 lg:text-base">
          Краткая информация о вашем учебном процессе.
        </p>
        {error ? (
          <p className="mt-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Мои курсы
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl">
            {overview?.summary.courses ?? 0}
          </p>
          <Link
            href="/dashboard/student/courses"
            className="mt-2 inline-flex rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
          >
            Открыть курсы
          </Link>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Задания к сдаче
          </p>
          <p
            className={
              dueSoon
                ? "mt-2 text-lg font-extrabold leading-none text-rose-600 sm:text-2xl lg:text-3xl"
                : "mt-2 text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl"
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

        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Средний балл (GPA)
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-emerald-600 sm:text-2xl lg:text-3xl">
            {overview?.summary.gpa ?? 0}
          </p>
          <p className="mt-2 text-sm text-slate-600">Средний балл</p>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Объявления
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl">
            {announcements.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Актуальные новости курса
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr] lg:gap-4">
        <article className="rounded-lg border border-slate-300 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-2.5 lg:rounded-[10px] lg:p-3">
          <h2 className="mb-2 px-0.5 text-base font-semibold leading-none text-slate-900 sm:mb-2.5 sm:text-lg lg:mb-3 lg:px-1 lg:text-2xl">
            Текущие курсы
          </h2>
          <div
            className={
              currentCourses.length > 4
                ? "max-h-[420px] space-y-2.5 overflow-y-auto pr-1 text-sm lg:space-y-3"
                : "space-y-2.5 text-sm lg:space-y-3"
            }
          >
            {currentCourses.length ? (
              currentCourses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 lg:rounded-lg lg:px-3 lg:py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="break-words text-sm font-semibold text-slate-900 lg:text-base">
                      {course.name}
                    </p>
                    <p className="whitespace-nowrap text-xs text-slate-700">
                      {course.progress}%
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 lg:text-sm">
                    Преподаватель: {course.teacher}
                  </p>
                  <p className="text-xs text-slate-600 lg:text-sm">
                    Статус: {course.status}
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200">
                    <div
                      className="h-1.5 rounded-full bg-slate-700"
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

        <article className="rounded-lg border border-slate-300 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-2.5 lg:rounded-[10px] lg:p-3">
          <h2 className="mb-2 text-base font-semibold leading-none text-slate-900 sm:mb-2.5 sm:text-lg lg:mb-3 lg:text-2xl">
            Задания к сдаче
          </h2>
          <div
            className={
              assignments.length > 4
                ? "max-h-[420px] space-y-2.5 overflow-y-auto pr-1 text-sm lg:space-y-3"
                : "space-y-2.5 text-sm lg:space-y-3"
            }
          >
            {assignments.length ? (
              assignments.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 lg:rounded-lg lg:px-3 lg:py-2"
                >
                  <p className="break-words text-sm font-semibold text-slate-900 lg:text-base">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 lg:text-sm">
                    Курс: {item.course}
                  </p>
                  <p className="text-xs text-slate-600 lg:text-sm">
                    Дата сдачи:{" "}
                    {item.dueDate
                      ? new Date(item.dueDate).toLocaleDateString()
                      : "Не указана"}
                  </p>
                  <p className="text-xs text-slate-600 lg:text-sm">
                    Статус: {item.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Нет активных заданий.</p>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-2.5 lg:rounded-[10px] lg:p-3">
          <h2 className="mb-2 text-base font-semibold leading-none text-slate-900 sm:mb-2.5 sm:text-lg lg:mb-3 lg:text-2xl">
            Последние оценки
          </h2>
          <div
            className={
              recentGrades.length > 4
                ? "max-h-[420px] space-y-2.5 overflow-y-auto pr-1 text-sm lg:space-y-3"
                : "space-y-2.5 text-sm lg:space-y-3"
            }
          >
            {recentGrades.length ? (
              recentGrades.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 lg:rounded-lg lg:px-3 lg:py-2"
                >
                  <p className="break-words text-sm font-semibold text-slate-900 lg:text-base">
                    {item.assignment}
                  </p>
                  <p className="text-xs text-slate-500 lg:text-sm">
                    Курс: {item.course}
                  </p>
                  <p className="text-xs text-slate-700 lg:text-sm">
                    Оценка: {item.grade ?? "Не оценено"}
                  </p>
                  <p className="break-words text-xs text-slate-600 lg:text-sm">
                    Комментарий: {item.comment ?? "-"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">Оценки пока отсутствуют.</p>
            )}
          </div>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-2.5 lg:rounded-[10px] lg:p-3">
          <h2 className="mb-2 text-base font-semibold leading-none text-slate-900 sm:mb-2.5 sm:text-lg lg:mb-3 lg:text-2xl">
            Объявления
          </h2>
          <div
            className={
              announcements.length > 4
                ? "max-h-[420px] space-y-2.5 overflow-y-auto pr-1 text-sm lg:space-y-3"
                : "space-y-2.5 text-sm lg:space-y-3"
            }
          >
            {announcements.length ? (
              announcements.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-2 lg:rounded-lg lg:px-3 lg:py-2"
                >
                  <p className="break-words text-sm font-semibold text-slate-900 lg:text-base">
                    {item.title}
                  </p>
                  <p className="break-words text-xs text-slate-600 lg:text-sm">
                    {item.text}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 lg:text-sm">
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
