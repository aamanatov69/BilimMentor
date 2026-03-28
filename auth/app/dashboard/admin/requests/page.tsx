"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type AccessRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  course?: {
    id: string;
    title: string;
  };
  student?: {
    id: string;
    fullName: string;
    email: string;
  };
  teacher?: {
    id: string;
    fullName: string;
    email: string;
  };
};

export default function AdminRequestsPage() {
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRequests = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `${API_URL}/api/admin/course-access-requests?status=pending`,
          {
            credentials: "include",
          },
        );
        const data = (await response.json()) as {
          requests?: AccessRequest[];
          message?: string;
        };

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить заявки");
          return;
        }

        setPendingRequests(data.requests ?? []);
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    };

    void loadRequests();
  }, []);

  return (
    <main className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <section className="dashboard-rise relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-cyan-50 p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Что делать сейчас
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Разберите заявки на доступ к курсам
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Проверьте курс, преподавателя и студента, затем передайте в работу
            ответственному.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/admin/users"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Проверить пользователей
            </Link>
            <Link
              href="/dashboard/admin/courses"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Перейти к курсам
            </Link>
          </div>
        </div>
      </section>

      <h2 className="text-lg font-semibold text-slate-900">
        Заявки в ожидании ({loading ? "..." : pendingRequests.length})
      </h2>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`requests-skeleton-${index}`}
                className="h-20 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <p>Нет заявок в ожидании.</p>
            <p className="mt-1 text-xs text-slate-500">
              Новые заявки появятся автоматически после запросов от студентов.
            </p>
          </div>
        ) : (
          pendingRequests.map((request) => (
            <article
              key={request.id}
              className="rounded border border-slate-200 p-4"
            >
              <p className="font-medium">
                {request.course?.title ?? "Курс без названия"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Студент:{" "}
                {request.student?.fullName ??
                  request.student?.email ??
                  "Неизвестно"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Преподаватель:{" "}
                {request.teacher?.fullName ??
                  request.teacher?.email ??
                  "Неизвестно"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(request.createdAt).toLocaleString()}
              </p>
              <div className="mt-3 flex gap-3 text-sm">
                {request.course?.id ? (
                  <Link
                    href={`/dashboard/admin/courses/${request.course.id}/teacher`}
                    className="text-blue-700 hover:underline"
                  >
                    Открыть курс
                  </Link>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
