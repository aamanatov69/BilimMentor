"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type ReportResponse = {
  generatedAt?: string;
  summary?: {
    users: number;
    students: number;
    teachers: number;
    admins: number;
    courses: number;
    enrollments: number;
    accessRequestsPending: number;
  };
  enrollmentByCourse?: {
    courseId: string;
    title: string;
    students: number;
  }[];
};

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState<ReportResponse | null>(null);

  const filterByDate = async () => {

    setError("");

    try {
      const response = await fetch(`${API_URL}/api/admin/reports`, {
          credentials: "include",
      });
      const data = (await response.json()) as ReportResponse & {
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось получить отчет");
        return;
      }

      setReport(data);
    } catch {
      setError("Ошибка сети");
    }
  };

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Отчеты</h1>
          <div className="flex gap-2">
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Дата от"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Дата до"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
            <button
              onClick={() => void filterByDate()}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Обновить
            </button>
          </div>
        </div>
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        {report?.generatedAt ? (
          <p className="mt-2 text-sm text-emerald-700">
            Отчет обновлен: {new Date(report.generatedAt).toLocaleString()}
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Пользователи</p>
          <p className="mt-2 text-2xl font-semibold">
            {report?.summary?.users ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Курсы</p>
          <p className="mt-2 text-2xl font-semibold">
            {report?.summary?.courses ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Зачисления</p>
          <p className="mt-2 text-2xl font-semibold">
            {report?.summary?.enrollments ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Ожидают решения</p>
          <p className="mt-2 text-2xl font-semibold text-orange-700">
            {report?.summary?.accessRequestsPending ?? 0}
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Зачисления по курсам</h2>
        <div className="mt-4 space-y-2">
          {(report?.enrollmentByCourse ?? []).map((item) => (
            <article
              key={item.courseId}
              className="rounded border border-slate-200 p-3"
            >
              <p className="font-medium">{item.title}</p>
              <p className="text-sm text-slate-600">
                Студентов: {item.students}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
