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

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [summary, setSummary] = useState<ReportSummary | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [meRes, reportsRes] = await Promise.all([
          fetch(`${API_URL}/api/me`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/admin/reports`, {
            credentials: "include",
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
    <main className="space-y-3 lg:space-y-4">
      <h1 className="text-xl font-bold leading-none text-slate-900 sm:text-2xl lg:text-[38px]">
        Рабочий стол
      </h1>

      <section className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
        <h2 className="text-base font-semibold text-slate-900 sm:text-lg lg:text-2xl">
          Панель администратора
        </h2>
        <p className="mt-1 text-sm text-slate-600 lg:text-base">
          Добро пожаловать, {displayName}. Полный доступ к управлению системой.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-3">
        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Всего студентов
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl">
            {summary?.students ?? 0}
          </p>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Всего преподавателей
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl">
            {summary?.teachers ?? 0}
          </p>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Активные курсы
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-slate-900 sm:text-2xl lg:text-3xl">
            {summary?.courses ?? 0}
          </p>
        </article>

        <article className="rounded-lg border border-slate-300 bg-white px-3 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:px-4 sm:py-3.5 lg:rounded-[10px] lg:px-5 lg:py-4">
          <p className="text-[10px] font-semibold leading-3 text-slate-700 sm:text-xs lg:text-[17px] lg:leading-5">
            Заявки в ожидании
          </p>
          <p className="mt-2 text-lg font-extrabold leading-none text-orange-600 sm:text-2xl lg:text-3xl">
            {summary?.accessRequestsPending ?? 0}
          </p>
          <Link
            href="/dashboard/admin/requests"
            className="mt-2 inline-flex rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:text-sm"
          >
            Открыть заявки
          </Link>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/dashboard/admin/users"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-slate-50 sm:px-4 sm:py-3.5 lg:rounded-[10px]"
        >
          Управление пользователями
        </Link>
        <Link
          href="/dashboard/admin/courses"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-slate-50 sm:px-4 sm:py-3.5 lg:rounded-[10px]"
        >
          Управление курсами
        </Link>
        <Link
          href="/dashboard/admin/reports"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-slate-50 sm:px-4 sm:py-3.5 lg:rounded-[10px]"
        >
          Отчеты
        </Link>
        <Link
          href="/dashboard/admin/system"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-slate-50 sm:px-4 sm:py-3.5 lg:rounded-[10px]"
        >
          Система
        </Link>
        <Link
          href="/dashboard/admin/settings"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-slate-50 sm:px-4 sm:py-3.5 lg:rounded-[10px]"
        >
          Настройки
        </Link>
        <Link
          href="/dashboard/admin/notifications"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:bg-slate-50 sm:px-4 sm:py-3.5 lg:rounded-[10px]"
        >
          Уведомления
        </Link>
      </section>
    </main>
  );
}
