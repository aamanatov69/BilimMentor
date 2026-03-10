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

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function AdminRequestsPage() {
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRequests = async () => {
      const token = getTokenFromCookie();
      if (!token) {
        setError("Требуется авторизация");
        return;
      }

      try {
        const response = await fetch(
          `${API_URL}/api/admin/course-access-requests?status=pending`,
          {
            headers: { Authorization: `Bearer ${token}` },
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
      }
    };

    void loadRequests();
  }, []);

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Заявки в ожидании</h1>
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 space-y-2">
        {pendingRequests.length === 0 ? (
          <p className="text-sm text-slate-600">Нет заявок в ожидании.</p>
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
