"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "admin";
}

type ReportSummary = {
  students: number;
  teachers: number;
  courses: number;
  accessRequestsPending: number;
};

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    const token = getTokenFromCookie();
    if (!token) {
      router.replace("/login");
      return;
    }

    const loadData = async () => {
      try {
        const [meRes, reportsRes] = await Promise.all([
          fetch(`${API_URL}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/admin/reports`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const meData = (await meRes.json()) as { user?: AdminUser };
        const reportsData = (await reportsRes.json()) as {
          summary?: ReportSummary;
        };
        if (!meRes.ok || !meData.user || meData.user.role !== "admin") {
          router.replace("/login");
          return;
        }

        if (reportsRes.ok) {
          setSummary(reportsData.summary ?? null);
        }

        setUser(meData.user);
      } catch {
        router.replace("/login");
      }
    };

    void loadData();
  }, [router]);

  const displayName = user?.fullName ?? "Администратор";

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">
          Панель администратора
        </h1>
        <p className="mt-2 text-slate-600">
          Добро пожаловать, {displayName}. Полный доступ к управлению системой.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Всего студентов</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">
            {summary?.students ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Всего преподавателей</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-700">
            {summary?.teachers ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Активные курсы</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">
            {summary?.courses ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Заявки в ожидании</p>
          <p className="mt-2 text-3xl font-semibold text-orange-600">
            {summary?.accessRequestsPending ?? 0}
          </p>
          <Link
            href="/dashboard/admin/requests"
            className="mt-2 inline-block text-sm text-blue-700 hover:underline"
          >
            Открыть заявки
          </Link>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Link
          href="/dashboard/admin/users"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
        >
          Управление пользователями
        </Link>
        <Link
          href="/dashboard/admin/courses"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
        >
          Управление курсами
        </Link>
        <Link
          href="/dashboard/admin/reports"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
        >
          Отчеты
        </Link>
        <Link
          href="/dashboard/admin/system"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
        >
          Система
        </Link>
        <Link
          href="/dashboard/admin/settings"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
        >
          Настройки
        </Link>
      </section>
    </main>
  );
}
