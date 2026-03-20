"use client";

import {
  Bell,
  BookOpen,
  GraduationCap,
  Home,
  LogOut,
  Search,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TEACHER_NOTIFICATIONS_SEEN_KEY = "nexoraTeacherNotificationsSeenAt";

type MeResponse = {
  user?: {
    id?: string;
    fullName?: string;
    role?: "student" | "teacher" | "admin";
  };
};

const sidebarItems = [
  { href: "/dashboard/teacher", label: "Главная", icon: Home, exact: true },
  { href: "/dashboard/teacher/courses", label: "Курсы", icon: BookOpen },
  { href: "/dashboard/teacher/students", label: "Студенты", icon: Users },
  { href: "/dashboard/teacher/grades", label: "Оценки", icon: Star },
  {
    href: "/dashboard/teacher/assignments",
    label: "Задания",
    icon: GraduationCap,
  },
  {
    href: "/dashboard/teacher/notifications",
    label: "Уведомления",
    icon: Bell,
  },
];

const emphasizedNavHrefs = new Set([
  "/dashboard/teacher/students",
  "/dashboard/teacher/grades",
  "/dashboard/teacher/assignments",
  "/dashboard/teacher/notifications",
]);

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [hasPendingReviews, setHasPendingReviews] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [teacherName, setTeacherName] = useState("Преподаватель");
  const hasAnyMenuAlerts = hasNewNotifications || hasPendingReviews;

  const teacherInitials =
    teacherName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "П";

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, {
      credentials: "include",
      method: "POST",
    });
    router.replace("/");
  };

  const isActivePath = (href: string, exact = false) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const desktopNavClass = (href: string, exact = false, emphasized = false) => {
    if (isActivePath(href, exact)) {
      return "flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-white shadow-sm";
    }

    if (emphasized) {
      return "flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100";
    }

    return "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100";
  };

  const mobileNavClass = (href: string, exact = false) =>
    isActivePath(href, exact)
      ? "flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white"
      : "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100";

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const loadTeacherProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/api/me`, {
          credentials: "include",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as MeResponse;
        const fullName = data.user?.fullName?.trim();

        if (!cancelled && fullName) {
          setTeacherName(fullName);
        }
      } catch {
        // Keep default fallback name when profile request fails.
      }
    };

    void loadTeacherProfile();

    return () => {
      cancelled = true;
    };
  }, []);

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

    const refreshIndicators = async () => {
      try {
        const [notificationsResponse, unreadCountResponse, gradesResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/notifications`, {
              credentials: "include",
            }),
            fetch(`${API_URL}/api/notifications/unread-count`, {
              credentials: "include",
            }),
            fetch(`${API_URL}/api/teacher/grades`, {
              credentials: "include",
            }),
          ]);

        if (!notificationsResponse.ok) {
          if (!cancelled) {
            setHasNewNotifications(false);
          }
        } else {
          const data = (await notificationsResponse.json()) as {
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
          } else {
            const seenAt =
              localStorage.getItem(TEACHER_NOTIFICATIONS_SEEN_KEY) ?? "";
            const hasNew =
              Boolean(latestCreatedAt) &&
              (!seenAt ||
                new Date(latestCreatedAt).getTime() >
                  new Date(seenAt).getTime());

            if (!cancelled) {
              setHasNewNotifications(hasNew);
            }
          }
        }

        if (unreadCountResponse.ok) {
          const countData = (await unreadCountResponse.json()) as {
            unreadCount?: number;
          };
          if (!cancelled) {
            setUnreadNotificationCount(countData.unreadCount ?? 0);
          }
        }

        if (!gradesResponse.ok) {
          if (!cancelled) {
            setHasPendingReviews(false);
          }
          return;
        }

        const gradesData = (await gradesResponse.json()) as {
          rows?: Array<{ score?: string | number | null }>;
        };
        const hasPending = (gradesData.rows ?? []).some(
          (row) => row.score === null || typeof row.score === "undefined",
        );

        if (!cancelled) {
          setHasPendingReviews(hasPending);
        }
      } catch {
        if (!cancelled) {
          setHasNewNotifications(false);
          setHasPendingReviews(false);
        }
      }
    };

    const handleUpdate = () => {
      void refreshIndicators();
    };

    void refreshIndicators();
    window.addEventListener("teacher-notifications-seen-updated", handleUpdate);
    window.addEventListener("teacher-grades-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      cancelled = true;
      window.removeEventListener(
        "teacher-notifications-seen-updated",
        handleUpdate,
      );
      window.removeEventListener("teacher-grades-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-3 py-2.5 sm:px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-2 sm:w-52">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-wide text-slate-800">
                Портал преподавателя
              </p>
              <p className="text-[11px] font-semibold text-slate-500"></p>
            </div>
          </div>

          <div className="hidden flex-1 items-center rounded-md border border-slate-300 bg-slate-100 px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-slate-500" />
            <span className="ml-2 text-sm text-slate-500">Поиск</span>
          </div>

          <div className="ml-auto flex items-center gap-3 text-sm font-semibold text-slate-700">
            <span className="hidden h-2.5 w-2.5 rounded-full bg-emerald-500 sm:inline-flex" />
            <span className="hidden sm:inline-flex">{teacherName}</span>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-700">
              {teacherInitials}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:px-3 sm:text-sm"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-0 px-0 lg:px-0">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <nav className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isEmphasized = emphasizedNavHrefs.has(item.href);
              const showBadge =
                item.href === "/dashboard/teacher/notifications" &&
                unreadNotificationCount > 0;
              const showDot =
                item.href === "/dashboard/teacher/grades" && hasPendingReviews;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={desktopNavClass(
                    item.href,
                    item.exact,
                    isEmphasized,
                  )}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
                      isActivePath(item.href, item.exact)
                        ? "bg-white/15"
                        : "bg-slate-200/80"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        isActivePath(item.href, item.exact)
                          ? "text-white"
                          : "text-slate-700"
                      }`}
                    />
                  </span>
                  <span className="flex items-center gap-2">
                    {item.label}
                    {showDot ? (
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                    ) : null}
                    {showBadge ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {unreadNotificationCount}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white lg:hidden">
        <div className="flex items-center justify-around gap-0">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.href, item.exact);
            const showDot =
              item.href === "/dashboard/teacher/grades" && hasPendingReviews;
            const showBadge =
              item.href === "/dashboard/teacher/notifications" &&
              hasNewNotifications;
            const isEmphasized = emphasizedNavHrefs.has(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 border-0 px-1 py-2.5 text-center ${
                  isEmphasized ? "rounded-lg" : "rounded-none"
                }`}
              >
                <div
                  className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    isActive
                      ? "bg-slate-800"
                      : isEmphasized
                        ? "bg-slate-100"
                        : "bg-transparent"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 transition-colors ${
                      isActive ? "text-white" : "text-slate-600"
                    }`}
                  />
                  {showDot ? (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                  ) : null}
                  {showBadge ? (
                    <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      5
                    </span>
                  ) : null}
                </div>
                <span
                  className={`text-[9px] font-semibold leading-3 transition-colors ${
                    isActive ? "text-slate-900" : "text-slate-600"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="h-20 lg:hidden" />
    </div>
  );
}
