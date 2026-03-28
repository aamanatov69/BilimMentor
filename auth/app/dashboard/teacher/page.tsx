"use client";

import { BookOpen, ClipboardCheck, Star, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  formatNotificationDate,
  localizeNotificationBody,
  localizeNotificationTitle,
} from "@/lib/notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type OverviewResponse = {
  summary?: {
    courses?: number;
    studentsEnrolled?: number;
    assignmentsToGrade?: number;
    pendingRequests?: number;
  };
  courses?: Array<{
    id: string;
    title: string;
    category?: string | null;
    progress?: number | null;
    studentsCount?: number;
  }>;
};

type NotificationsResponse = {
  notifications?: Array<{
    id: string;
    title: string;
    body: string;
    createdAt: string;
  }>;
};

export default function TeacherDashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [notifications, setNotifications] = useState<
    NotificationsResponse["notifications"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const [overviewResponse, notificationsResponse] = await Promise.all([
          fetch(`${API_URL}/api/teacher/overview`, { credentials: "include" }),
          fetch(`${API_URL}/api/notifications`, { credentials: "include" }),
        ]);

        const overviewData =
          (await overviewResponse.json()) as OverviewResponse & {
            message?: string;
          };

        if (!overviewResponse.ok) {
          setError(
            overviewData.message ??
              "Не удалось загрузить рабочее место преподавателя",
          );
          return;
        }

        const notificationsData = notificationsResponse.ok
          ? ((await notificationsResponse.json()) as NotificationsResponse)
          : { notifications: [] };

        setOverview(overviewData);
        setNotifications(notificationsData.notifications ?? []);
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "Курсы",
        value: overview?.summary?.courses ?? 0,
        icon: BookOpen,
        hint: "Активных курсов",
        color: "text-sky-700 bg-sky-100",
      },
      {
        title: "Студенты",
        value: overview?.summary?.studentsEnrolled ?? 0,
        icon: Users,
        hint: "Учатся у вас",
        color: "text-emerald-700 bg-emerald-100",
      },
      {
        title: "Новые заявки",
        value: overview?.summary?.pendingRequests ?? 0,
        icon: ClipboardCheck,
        hint: "Требуют ответа",
        color: "text-amber-700 bg-amber-100",
      },
      {
        title: "На проверку",
        value: overview?.summary?.assignmentsToGrade ?? 0,
        icon: Star,
        hint: "Работ ожидают оценку",
        color: "text-rose-700 bg-rose-100",
      },
    ],
    [overview],
  );

  const chartRows = useMemo(
    () =>
      (overview?.courses ?? []).slice(0, 6).map((course) => ({
        id: course.id,
        title: course.title,
        students: course.studentsCount ?? 0,
        progress: Math.max(0, Math.min(100, Number(course.progress ?? 0))),
      })),
    [overview?.courses],
  );

  const assignmentsToGrade = overview?.summary?.assignmentsToGrade ?? 0;

  return (
    <main className="space-y-5">
      <section className="dashboard-rise relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-emerald-300/25 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Что делать сейчас
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Начните с задач, которые влияют на успеваемость
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Сначала проверьте работы, затем ответьте на заявки и обновите курс.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/teacher/grades"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Проверить работы ({loading ? "..." : assignmentsToGrade})
            </Link>
            <Link
              href="/dashboard/teacher/students"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Открыть список студентов
            </Link>
            <Link
              href="/dashboard/teacher/courses/new"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Создать новый курс
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {card.title}
                </p>
                <span className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {loading ? "..." : card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="dashboard-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Быстрый старт преподавателя
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Если вы только начали работу, пройдите эти шаги по порядку.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Link
            href="/dashboard/teacher/courses/new"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            1. Создать курс
          </Link>
          <Link
            href="/dashboard/teacher/assignments"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            2. Добавить задание
          </Link>
          <Link
            href="/dashboard/teacher/grades"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            3. Проверить первые работы
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Прогресс по курсам
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Быстро видно, где нужен дополнительный фокус преподавателя.
          </p>

          <div className="mt-4 space-y-3">
            {chartRows.length ? (
              chartRows.map((row) => (
                <div key={row.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <p className="truncate font-semibold text-slate-800">
                      {row.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {row.students} студентов
                    </p>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500"
                      style={{ width: `${row.progress}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-600">
                  Пока нет данных по курсам. Создайте курс и добавьте первый
                  урок, чтобы увидеть аналитику.
                </p>
                <Link
                  href="/dashboard/teacher/courses/new"
                  className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Добавить первый курс
                </Link>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Лента событий
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Новые изменения по курсам, оценкам и активности.
          </p>
          <div className="mt-4 space-y-2">
            {(notifications ?? []).slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 p-3"
              >
                <p className="text-xs font-semibold text-slate-900">
                  {localizeNotificationTitle(item.title)}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {localizeNotificationBody(item.body)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatNotificationDate(item.createdAt)}
                </p>
              </div>
            ))}

            {!notifications?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-600">Событий пока нет.</p>
                <Link
                  href="/dashboard/teacher/notifications"
                  className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Перейти в уведомления
                </Link>
              </div>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
