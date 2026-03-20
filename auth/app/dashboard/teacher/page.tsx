"use client";

import { BookOpen, ClipboardCheck, FileText, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  formatNotificationDate,
  localizeNotificationBody,
  localizeNotificationTitle,
} from "@/lib/notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const DASHBOARD_REFRESH_INTERVAL_MS = 60_000;

type OverviewResponse = {
  summary?: {
    courses?: number;
    studentsEnrolled?: number;
    assignmentsToGrade?: number;
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

type StatCard = {
  icon: typeof BookOpen;
  iconBg: string;
  label: string;
  value: string;
};

type DashboardCourse = {
  id: string;
  title: string;
  students: number;
  progress: number;
  icon: typeof BookOpen;
};

type FeedItem = {
  title: string;
  subtitle: string;
};

function courseIconByTitle(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("python")) {
    return FileText;
  }
  if (normalized.includes("веб") || normalized.includes("web")) {
    return BookOpen;
  }
  return ClipboardCheck;
}

export default function TeacherDashboardPage() {
  const [statCards, setStatCards] = useState<StatCard[]>([
    {
      icon: BookOpen,
      iconBg: "bg-blue-100 text-blue-700",
      label: "Всего курсов",
      value: "0",
    },
    {
      icon: Users,
      iconBg: "bg-emerald-100 text-emerald-700",
      label: "Активных студентов",
      value: "0",
    },
    {
      icon: Star,
      iconBg: "bg-amber-100 text-amber-700",
      label: "Ожидают оценки",
      value: "0",
    },
  ]);
  const [activeCourses, setActiveCourses] = useState<DashboardCourse[]>([]);
  const [activityFeed, setActivityFeed] = useState<FeedItem[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setLoadError("");

        const [overviewResponse, notificationsResponse] = await Promise.all([
          fetch(`${API_URL}/api/teacher/overview`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/notifications`, {
            credentials: "include",
          }),
        ]);

        if (!overviewResponse.ok) {
          if (!cancelled) {
            setLoadError("Не удалось загрузить данные дашборда");
          }
          return;
        }

        const overview = (await overviewResponse.json()) as OverviewResponse;
        const notifications = notificationsResponse.ok
          ? ((await notificationsResponse.json()) as NotificationsResponse)
          : { notifications: [] };

        const courses = (overview.courses ?? []).slice(0, 3);

        if (cancelled) {
          return;
        }

        setStatCards([
          {
            icon: BookOpen,
            iconBg: "bg-blue-100 text-blue-700",
            label: "Всего курсов",
            value: String(overview.summary?.courses ?? 0),
          },
          {
            icon: Users,
            iconBg: "bg-emerald-100 text-emerald-700",
            label: "Активных студентов",
            value: String(overview.summary?.studentsEnrolled ?? 0),
          },
          {
            icon: Star,
            iconBg: "bg-amber-100 text-amber-700",
            label: "Ожидают оценки",
            value: String(overview.summary?.assignmentsToGrade ?? 0),
          },
        ]);

        setActiveCourses(
          courses.map((course) => ({
            id: course.id,
            title: course.title,
            students: course.studentsCount ?? 0,
            progress: Math.max(
              0,
              Math.min(100, Number(course.progress ?? 0) || 0),
            ),
            icon: courseIconByTitle(course.title),
          })),
        );

        setActivityFeed(
          (notifications.notifications ?? []).slice(0, 6).map((item) => ({
            title: localizeNotificationTitle(item.title),
            subtitle: `${localizeNotificationBody(item.body)} · ${formatNotificationDate(item.createdAt)}`,
          })),
        );
      } catch {
        if (!cancelled) {
          setLoadError("Ошибка сети при загрузке дашборда");
        }
      }
    };

    void loadDashboard();
    const refreshInterval = window.setInterval(() => {
      void loadDashboard();
    }, DASHBOARD_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, []);

  return (
    <main className="space-y-3 lg:space-y-4">
      <h1 className="text-xl font-bold leading-none text-slate-900 sm:text-2xl lg:text-[38px]">
        Рабочий стол
      </h1>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {loadError}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        {statCards.map((item) => {
          const Icon = item.icon;

          return (
            <article
              key={item.label}
              className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4"
            >
              <div className="flex items-center gap-2 sm:gap-2.5 lg:gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-9 sm:w-9 lg:h-11 lg:w-11 ${item.iconBg}`}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
                    {item.label}
                  </p>
                  <p className="text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl">
                    {item.value}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr] lg:gap-4">
        <article className="rounded-lg border border-slate-300 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-2.5 lg:rounded-[10px] lg:p-3">
          <h2 className="mb-2 px-0.5 text-base font-semibold leading-none text-slate-900 sm:mb-2.5 sm:text-lg lg:mb-3 lg:px-1 lg:text-2xl">
            Текущие курсы
          </h2>

          <div className="space-y-2 sm:space-y-2.5 lg:space-y-3">
            {activeCourses.map((course) => {
              const Icon = course.icon;

              return (
                <div
                  key={`${course.title}-${course.students}`}
                  className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 sm:px-2.5 sm:py-2 lg:rounded-lg lg:px-3 lg:py-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 lg:mb-1.5 lg:gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-700 text-white sm:h-8 sm:w-8 lg:h-9 lg:w-9">
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <p className="truncate text-xs font-semibold leading-4 text-slate-900 sm:text-sm lg:text-lg">
                        {course.title}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-[10px] font-medium text-slate-800 sm:text-xs lg:text-base">
                      {course.students} студентов
                    </p>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-300 sm:h-2 lg:h-[7px]">
                    <div
                      className="h-full rounded-full bg-slate-700"
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {activeCourses.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Нет курсов для отображения.
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-2.5 lg:rounded-[10px] lg:p-3">
          <h2 className="mb-2 text-base font-semibold leading-none text-slate-900 sm:mb-2.5 sm:text-lg lg:mb-3 lg:text-2xl">
            Уведомления
          </h2>

          <div className="min-h-[200px] max-h-[300px] space-y-2 overflow-y-auto pr-1 sm:space-y-2.5 sm:max-h-[400px] lg:max-h-[520px] lg:space-y-3">
            {activityFeed.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="flex items-start gap-2"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-white sm:h-8 sm:w-8 lg:mt-1 lg:h-10 lg:w-10">
                  <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-4 text-slate-900 sm:text-sm lg:text-base">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-slate-600 sm:text-xs lg:text-xs">
                    {item.subtitle}
                  </p>
                </div>
              </div>
            ))}
            {activityFeed.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Уведомлений пока нет.
              </p>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
