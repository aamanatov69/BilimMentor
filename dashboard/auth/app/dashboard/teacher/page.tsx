"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface TeacherUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "teacher";
}

type TeacherOverview = {
  summary: {
    courses: number;
    assignmentsToGrade: number;
    studentsEnrolled: number;
    pendingRequests: number;
  };
};

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<TeacherUser | null>(null);
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
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
          fetch(`${API_URL}/api/teacher/overview`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const meData = (await meRes.json()) as {
          user?: TeacherUser;
          message?: string;
        };
        const overviewData = (await overviewRes.json()) as TeacherOverview & {
          message?: string;
        };

        if (!meRes.ok || !meData.user || meData.user.role !== "teacher") {
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

  const displayName = user?.fullName ?? "Преподаватель";

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">Панель преподавателя</h1>
        <p className="mt-2 text-slate-600">
          Добро пожаловать, {displayName}. Управляйте курсами, заявками и
          оценками.
        </p>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Мои курсы</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">
            {overview?.summary.courses ?? 0}
          </p>
          <Link
            href="/dashboard/teacher/courses"
            className="mt-2 inline-block text-sm text-blue-700 hover:underline"
          >
            Открыть курсы
          </Link>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Задания для оценки</p>
          <p className="mt-2 text-3xl font-semibold text-orange-600">
            {overview?.summary.assignmentsToGrade ?? 0}
          </p>
          <Link
            href="/dashboard/teacher/assignments"
            className="mt-2 inline-block text-sm text-blue-700 hover:underline"
          >
            Перейти к заданию
          </Link>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Студенты, записанные на курсы</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600">
            {overview?.summary.studentsEnrolled ?? 0}
          </p>
          <Link
            href="/dashboard/teacher/students"
            className="mt-2 inline-block text-sm text-blue-700 hover:underline"
          >
            Список студентов
          </Link>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Заявок на доступ к курсам в ожидании:{" "}
          {overview?.summary.pendingRequests ?? 0}
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link
          href="/dashboard/teacher/courses"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
        >
          Курсы
        </Link>
        <Link
          href="/dashboard/teacher/grades"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:bg-slate-50"
        >
          Управление оценками
        </Link>
      </section>
    </main>
  );
}
