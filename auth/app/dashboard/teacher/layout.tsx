"use client";

import {
  Bell,
  GraduationCap,
  LogOut,
  Menu,
  UserCircle2,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TEACHER_NOTIFICATIONS_SEEN_KEY = "nexoraTeacherNotificationsSeenAt";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navClass = (href: string, exact = false, mobile = false) => {
    const isActive = exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

    if (mobile) {
      return isActive
        ? "rounded-md bg-blue-100 px-3 py-2 font-medium text-blue-700"
        : "rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-blue-700";
    }

    return isActive
      ? "whitespace-nowrap rounded-md bg-blue-100 px-2 py-1 font-medium text-blue-700"
      : "whitespace-nowrap rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-blue-700";
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    const refreshNotificationsFlag = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications`, {
          credentials: "include",
        });

        if (!response.ok) {
          if (!cancelled) {
            setHasNewNotifications(false);
          }
          return;
        }

        const data = (await response.json()) as {
          notifications?: Array<{ createdAt: string }>;
        };
        const latestCreatedAt = data.notifications?.[0]?.createdAt ?? "";

        if (pathname.startsWith("/dashboard/teacher/notifications")) {
          if (latestCreatedAt) {
            localStorage.setItem(
              TEACHER_NOTIFICATIONS_SEEN_KEY,
              latestCreatedAt,
            );
          }
          if (!cancelled) {
            setHasNewNotifications(false);
          }
          return;
        }

        const seenAt =
          localStorage.getItem(TEACHER_NOTIFICATIONS_SEEN_KEY) ?? "";
        const hasNew =
          Boolean(latestCreatedAt) &&
          (!seenAt ||
            new Date(latestCreatedAt).getTime() > new Date(seenAt).getTime());

        if (!cancelled) {
          setHasNewNotifications(hasNew);
        }
      } catch {
        if (!cancelled) {
          setHasNewNotifications(false);
        }
      }
    };

    const handleSeenUpdate = () => {
      void refreshNotificationsFlag();
    };

    void refreshNotificationsFlag();
    window.addEventListener(
      "teacher-notifications-seen-updated",
      handleSeenUpdate,
    );
    window.addEventListener("storage", handleSeenUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(
        "teacher-notifications-seen-updated",
        handleSeenUpdate,
      );
      window.removeEventListener("storage", handleSeenUpdate);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-100 p-3 text-slate-800 sm:p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="relative z-30 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
          <div className="flex items-center justify-between gap-3 md:gap-4">
            <div className="flex min-w-0 items-center gap-3 md:flex-1">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-700 text-white">
                <GraduationCap className="h-4 w-4" />
              </div>
              <p className="truncate text-xs font-semibold tracking-wide text-blue-700 sm:text-sm">
                ПОРТАЛ ПРЕПОДАВАТЕЛЯ
              </p>
            </div>

            <nav className="hidden items-center justify-center gap-2 overflow-x-auto text-sm md:flex">
              <Link
                className={navClass("/dashboard/teacher", true)}
                href="/dashboard/teacher"
              >
                Главная
              </Link>
              <Link
                className={navClass("/dashboard/teacher/courses")}
                href="/dashboard/teacher/courses"
              >
                Курсы
              </Link>
              <Link
                className={navClass("/dashboard/teacher/students")}
                href="/dashboard/teacher/students"
              >
                Студенты
              </Link>
              <Link
                className={navClass("/dashboard/teacher/grades")}
                href="/dashboard/teacher/grades"
              >
                Оценки
              </Link>
              <Link
                className={navClass("/dashboard/teacher/assignments")}
                href="/dashboard/teacher/assignments"
              >
                Задания
              </Link>
              <Link
                className={navClass("/dashboard/teacher/notifications")}
                href="/dashboard/teacher/notifications"
              >
                <span className="inline-flex items-center gap-1.5">
                  Уведомления
                  {hasNewNotifications ? (
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                  ) : null}
                </span>
              </Link>
            </nav>

            <div className="flex items-center gap-2 md:flex-1 md:justify-end">
              <button
                type="button"
                className="rounded-md border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50 md:hidden"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
              >
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
              <Bell className="hidden h-4 w-4 text-slate-500 sm:block" />
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={async () => {
                  await fetch(`${API_URL}/api/auth/logout`, {
                    credentials: "include",
                    method: "POST",
                  });
                  router.replace("/");
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <LogOut className="h-4 w-4" />
                  Выйти
                </span>
              </button>
              <UserCircle2 className="hidden h-8 w-8 text-slate-500 sm:block" />
            </div>
          </div>

          {mobileMenuOpen ? (
            <nav className="mt-3 grid gap-1 border-t border-slate-200 pt-3 text-sm md:hidden">
              <Link
                className={navClass("/dashboard/teacher", true, true)}
                href="/dashboard/teacher"
              >
                Главная
              </Link>
              <Link
                className={navClass("/dashboard/teacher/courses", false, true)}
                href="/dashboard/teacher/courses"
              >
                Курсы
              </Link>
              <Link
                className={navClass("/dashboard/teacher/students", false, true)}
                href="/dashboard/teacher/students"
              >
                Студенты
              </Link>
              <Link
                className={navClass("/dashboard/teacher/grades", false, true)}
                href="/dashboard/teacher/grades"
              >
                Оценки
              </Link>
              <Link
                className={navClass(
                  "/dashboard/teacher/assignments",
                  false,
                  true,
                )}
                href="/dashboard/teacher/assignments"
              >
                Задания
              </Link>
              <Link
                className={navClass(
                  "/dashboard/teacher/notifications",
                  false,
                  true,
                )}
                href="/dashboard/teacher/notifications"
              >
                <span className="inline-flex items-center gap-1.5">
                  Уведомления
                  {hasNewNotifications ? (
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                  ) : null}
                </span>
              </Link>
            </nav>
          ) : null}
        </header>

        {mobileMenuOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-slate-900/25 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Закрыть меню"
          />
        ) : null}

        {children}
      </div>
    </div>
  );
}
