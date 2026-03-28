"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ReportSummary = {
  users: number;
  students: number;
  teachers: number;
  admins: number;
  courses: number;
  enrollments: number;
  accessRequestsPending: number;
};

type ReportsResponse = {
  summary?: ReportSummary;
  coursesByCategory?: Record<string, number>;
};

export default function AdminDashboardPage() {
  const [reports, setReports] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_URL}/api/admin/reports`, {
          credentials: "include",
        });

        const data = (await response.json()) as ReportsResponse & {
          message?: string;
        };
        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить отчеты");
          return;
        }

        setReports(data);
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
        title: "Пользователи",
        value: reports?.summary?.users ?? 0,
        accent: "from-sky-500 to-blue-500",
      },
      {
        title: "Курсы",
        value: reports?.summary?.courses ?? 0,
        accent: "from-emerald-500 to-teal-500",
      },
      {
        title: "Заявки",
        value: reports?.summary?.accessRequestsPending ?? 0,
        accent: "from-amber-500 to-orange-500",
      },
      {
        title: "Зачисления",
        value: reports?.summary?.enrollments ?? 0,
        accent: "from-indigo-500 to-cyan-500",
      },
    ],
    [reports],
  );

  const roleSegments = [
    { label: "Студенты", value: reports?.summary?.students ?? 0 },
    { label: "Преподаватели", value: reports?.summary?.teachers ?? 0 },
    { label: "Администраторы", value: reports?.summary?.admins ?? 0 },
  ];

  const maxRoleValue = Math.max(1, ...roleSegments.map((item) => item.value));
  const categories = Object.entries(reports?.coursesByCategory ?? {}).slice(
    0,
    8,
  );
  const maxCategoryValue = Math.max(1, ...categories.map(([, value]) => value));

  return (
    <main className="space-y-5">
      <section className="dashboard-rise relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-cyan-50 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-cyan-300/25 blur-3xl" />

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Требует решения сейчас
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Держите платформу в стабильном состоянии
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Начните с заявок на доступ, затем проверьте пользователей и
            целостность данных.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/admin/requests"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Разобрать заявки (
              {loading ? "..." : (reports?.summary?.accessRequestsPending ?? 0)}
              )
            </Link>
            <Link
              href="/dashboard/admin/users"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Проверить пользователей
            </Link>
            <Link
              href="/dashboard/admin/settings"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Резервные копии
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
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-700">{card.title}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? "..." : card.value}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${card.accent}`}
                style={{
                  width: `${Math.max(8, Math.min(100, Number(card.value) * 2))}%`,
                }}
              />
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Быстрый старт администратора
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Порядок действий, чтобы система была стабильной с первого дня.
        </p>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Link
            href="/dashboard/admin/requests"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            1. Проверить заявки
          </Link>
          <Link
            href="/dashboard/admin/users"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            2. Актуализировать роли
          </Link>
          <Link
            href="/dashboard/admin/settings"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 hover:bg-white"
          >
            3. Проверить резервное копирование
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Распределение ролей
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Баланс ролей помогает быстро оценить нагрузку на поддержку и
            обучение.
          </p>
          <div className="mt-4 space-y-3">
            {roleSegments.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {item.value}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${(item.value / maxRoleValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Курсы по категориям
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Отслеживайте, какие направления растут быстрее остальных.
          </p>
          <div className="mt-4 space-y-3">
            {categories.length ? (
              categories.map(([category, value]) => (
                <div key={category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate font-medium text-slate-700">
                      {category}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {value}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                      style={{ width: `${(value / maxCategoryValue) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm text-slate-600">
                  Данных по категориям пока нет. Создайте первый курс или
                  назначьте категорию существующим.
                </p>
                <Link
                  href="/dashboard/admin/courses"
                  className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Перейти к курсам
                </Link>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
