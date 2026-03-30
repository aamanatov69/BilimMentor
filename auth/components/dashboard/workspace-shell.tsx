"use client";

import {
  formatNotificationDate,
  localizeNotificationBody,
  localizeNotificationTitle,
  localizeNotificationType,
} from "@/lib/notifications";
import {
  Bell,
  ChevronDown,
  LogOut,
  Search,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type DashboardRole = "student" | "teacher" | "admin";

type MeResponse = {
  user?: {
    id?: string;
    fullName?: string;
    role?: DashboardRole;
  };
};

type NotificationItem = {
  id: string;
  type:
    | "assignment_deadline"
    | "grade_posted"
    | "new_announcement"
    | "system_message";
  title: string;
  body: string;
  createdAt: string;
  isRead?: boolean;
};

type SearchResultItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  kind: "course" | "lesson" | "user";
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

type WorkspaceShellProps = {
  role: DashboardRole;
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  children: React.ReactNode;
  defaultName: string;
  initialsFallback: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function groupedNotifications(notifications: NotificationItem[]) {
  const groups = {
    assignments: [] as NotificationItem[],
    courses: [] as NotificationItem[],
    system: [] as NotificationItem[],
  };

  for (const item of notifications) {
    if (item.type === "assignment_deadline" || item.type === "grade_posted") {
      groups.assignments.push(item);
      continue;
    }
    if (item.type === "new_announcement") {
      groups.courses.push(item);
      continue;
    }
    groups.system.push(item);
  }

  return groups;
}

export function WorkspaceShell(props: WorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [profileName, setProfileName] = useState(props.defaultName);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const notificationsContainerRef = useRef<HTMLDivElement | null>(null);

  const initials =
    profileName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase() ?? "")
      .join("") || props.initialsFallback;

  const notificationGroups = useMemo(
    () => groupedNotifications(notifications),
    [notifications],
  );

  const totalMenuAlerts = unreadCount + alertsCount;

  const isActivePath = (href: string, exact = false) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as MeResponse;
      const fullName = data.user?.fullName?.trim();
      if (fullName) {
        setProfileName(fullName);
      }
    } catch {
      // Keep fallback profile name.
    }
  };

  const loadNotifications = async () => {
    try {
      const [listResponse, countResponse] = await Promise.all([
        fetch(`${API_URL}/api/notifications`, { credentials: "include" }),
        fetch(`${API_URL}/api/notifications/unread-count`, {
          credentials: "include",
        }),
      ]);

      if (listResponse.ok) {
        const listData = (await listResponse.json()) as {
          notifications?: NotificationItem[];
        };
        setNotifications(listData.notifications ?? []);
      }

      if (countResponse.ok) {
        const countData = (await countResponse.json()) as {
          unreadCount?: number;
        };
        setUnreadCount(countData.unreadCount ?? 0);
      }
    } catch {
      // Ignore notification load errors for shell.
    }
  };

  const loadRoleAlerts = async () => {
    try {
      if (props.role === "student") {
        const response = await fetch(`${API_URL}/api/student/assignments`, {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          assignments?: Array<{ submission?: unknown }>;
        };
        const pending = (data.assignments ?? []).filter(
          (item) => !item.submission,
        ).length;
        setAlertsCount(pending);
        return;
      }

      if (props.role === "teacher") {
        const response = await fetch(`${API_URL}/api/teacher/grades`, {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as {
          rows?: Array<{ score?: number | string | null }>;
        };
        const pending = (data.rows ?? []).filter(
          (item) => item.score === null || typeof item.score === "undefined",
        ).length;
        setAlertsCount(pending);
        return;
      }

      const response = await fetch(`${API_URL}/api/admin/reports`, {
        credentials: "include",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        summary?: { accessRequestsPending?: number };
      };
      setAlertsCount(data.summary?.accessRequestsPending ?? 0);
    } catch {
      // Ignore alerts load errors for shell.
    }
  };

  const loadSearchIndex = async () => {
    setSearchLoading(true);
    try {
      if (props.role === "student") {
        const [discoverResponse, enrolledResponse] = await Promise.all([
          fetch(`${API_URL}/api/student/courses/discover`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/student/courses`, { credentials: "include" }),
        ]);

        const combined: SearchResultItem[] = [];

        if (discoverResponse.ok) {
          const data = (await discoverResponse.json()) as {
            courses?: Array<{ id: string; title: string; description: string }>;
          };
          for (const course of data.courses ?? []) {
            combined.push({
              id: `discover-${course.id}`,
              label: course.title,
              description: course.description || "Курс из каталога",
              href: `/dashboard/student/courses`,
              kind: "course",
            });
          }
        }

        if (enrolledResponse.ok) {
          const data = (await enrolledResponse.json()) as {
            courses?: Array<{
              id: string;
              title: string;
              description: string;
              modules?: Array<Record<string, unknown>>;
            }>;
          };

          for (const course of data.courses ?? []) {
            combined.push({
              id: `enrolled-${course.id}`,
              label: course.title,
              description: course.description || "Мой курс",
              href: `/dashboard/student/courses/${course.id}`,
              kind: "course",
            });

            const lessons = Array.isArray(course.modules)
              ? course.modules.filter(
                  (module) =>
                    asString(module.type).toLowerCase() === "lesson" &&
                    module.isVisibleToStudents !== false,
                )
              : [];

            for (const lesson of lessons) {
              const lessonId = asString(lesson.id) || "lesson";
              combined.push({
                id: `lesson-${course.id}-${lessonId}`,
                label: asString(lesson.title) || "Урок",
                description: `Урок курса ${course.title}`,
                href: `/dashboard/student/courses/${course.id}`,
                kind: "lesson",
              });
            }
          }
        }

        setSearchResults(combined);
        return;
      }

      if (props.role === "teacher") {
        const response = await fetch(`${API_URL}/api/teacher/courses`, {
          credentials: "include",
        });
        if (!response.ok) {
          setSearchResults([]);
          return;
        }

        const data = (await response.json()) as {
          courses?: Array<{
            id: string;
            title: string;
            description: string;
            modules?: Array<Record<string, unknown>>;
          }>;
        };

        const items: SearchResultItem[] = [];

        for (const course of data.courses ?? []) {
          items.push({
            id: `course-${course.id}`,
            label: course.title,
            description: course.description || "Курс преподавателя",
            href: "/dashboard/teacher/courses",
            kind: "course",
          });

          const lessons = Array.isArray(course.modules)
            ? course.modules.filter(
                (module) => asString(module.type).toLowerCase() === "lesson",
              )
            : [];

          for (const lesson of lessons) {
            const lessonId = asString(lesson.id) || "lesson";
            items.push({
              id: `lesson-${course.id}-${lessonId}`,
              label: asString(lesson.title) || "Урок",
              description: `Урок курса ${course.title}`,
              href: `/dashboard/teacher/courses?course=${course.id}`,
              kind: "lesson",
            });
          }
        }

        setSearchResults(items);
        return;
      }

      const [coursesResponse, usersResponse] = await Promise.all([
        fetch(`${API_URL}/api/courses`, { credentials: "include" }),
        fetch(`${API_URL}/api/admin/users`, { credentials: "include" }),
      ]);

      const items: SearchResultItem[] = [];

      if (coursesResponse.ok) {
        const data = (await coursesResponse.json()) as {
          courses?: Array<{
            id: string;
            title: string;
            description: string;
            modules?: Array<Record<string, unknown>>;
          }>;
        };

        for (const course of data.courses ?? []) {
          items.push({
            id: `course-${course.id}`,
            label: course.title,
            description: course.description || "Курс",
            href: "/dashboard/admin/courses",
            kind: "course",
          });

          const lessons = Array.isArray(course.modules)
            ? course.modules.filter(
                (module) => asString(module.type).toLowerCase() === "lesson",
              )
            : [];
          for (const lesson of lessons) {
            const lessonId = asString(lesson.id) || "lesson";
            items.push({
              id: `lesson-${course.id}-${lessonId}`,
              label: asString(lesson.title) || "Урок",
              description: `Урок курса ${course.title}`,
              href: "/dashboard/admin/courses",
              kind: "lesson",
            });
          }
        }
      }

      if (usersResponse.ok) {
        const data = (await usersResponse.json()) as {
          users?: Array<{
            id: string;
            fullName: string;
            role: string;
            email: string;
          }>;
        };
        for (const user of data.users ?? []) {
          items.push({
            id: `user-${user.id}`,
            label: user.fullName,
            description: `${user.role} · ${user.email}`,
            href: "/dashboard/admin/users",
            kind: "user",
          });
        }
      }

      setSearchResults(items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    void loadNotifications();
    void loadRoleAlerts();
    const interval = window.setInterval(() => {
      void loadNotifications();
      void loadRoleAlerts();
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [props.role]);

  useEffect(() => {
    if (!searchOpen || searchResults.length > 0 || searchLoading) {
      return;
    }
    void loadSearchIndex();
  }, [searchOpen, searchResults.length, searchLoading]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        searchOpen &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(target)
      ) {
        setSearchOpen(false);
      }

      if (
        notificationsOpen &&
        notificationsContainerRef.current &&
        !notificationsContainerRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [searchOpen, notificationsOpen]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [pathname]);

  const shouldShowAlertDot = (href: string) => {
    if (alertsCount <= 0) {
      return false;
    }

    if (props.role === "student") {
      return href === "/dashboard/student/assignments";
    }

    if (props.role === "teacher") {
      return href === "/dashboard/teacher/grades";
    }

    return href === "/dashboard/admin/requests";
  };

  const hasFixedMobileButtons =
    props.role === "teacher" || props.role === "student";

  const filteredSearch = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return searchResults.slice(0, 10);
    }
    return searchResults
      .filter((item) => {
        const haystack = `${item.label} ${item.description}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 10);
  }, [searchQuery, searchResults]);

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    const trail: Array<{ href: string; label: string; isCurrent: boolean }> =
      [];

    const roleRoot = `/dashboard/${props.role}`;
    trail.push({
      href: roleRoot,
      label:
        props.navItems.find((item) => item.href === roleRoot)?.label ??
        "Главная",
      isCurrent: pathname === roleRoot,
    });

    if (segments.length <= 2) {
      return trail;
    }

    let currentPath = "";
    for (let index = 0; index < segments.length; index += 1) {
      currentPath += `/${segments[index]}`;
      if (currentPath === roleRoot || currentPath === "/dashboard") {
        continue;
      }

      const navLabel = props.navItems.find(
        (item) => item.href === currentPath,
      )?.label;
      const segmentLabel = navLabel
        ? navLabel
        : decodeURIComponent(segments[index])
            .replace(/[-_]/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase());

      trail.push({
        href: currentPath,
        label: segmentLabel,
        isCurrent: currentPath === pathname,
      });
    }

    return trail;
  }, [pathname, props.navItems, props.role]);

  const handleLogout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.replace("/");
  };

  const markAsRead = async (notificationId: string) => {
    await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    await Promise.all([loadNotifications(), loadRoleAlerts()]);
  };

  const markAllRead = async () => {
    await fetch(`${API_URL}/api/notifications/read/all`, {
      method: "PATCH",
      credentials: "include",
    });
    await Promise.all([loadNotifications(), loadRoleAlerts()]);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_34%),radial-gradient(circle_at_85%_12%,#cffafe,transparent_30%),radial-gradient(circle_at_bottom_right,#fef3c7,transparent_32%),#f8fafc] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 lg:px-6">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{props.title}</p>
            {props.subtitle ? (
              <p className="hidden text-xs text-slate-500 sm:block">
                {props.subtitle}
              </p>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div ref={searchContainerRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-600 shadow-sm hover:bg-white"
              >
                <Search className="h-4 w-4" />
                Поиск
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  /
                </span>
              </button>

              {searchOpen ? (
                <div className="absolute right-0 top-12 w-[520px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Курсы, уроки и пользователи"
                      className="h-10 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                    />
                  </div>

                  <div className="mt-3 max-h-[320px] space-y-1 overflow-y-auto">
                    {searchLoading ? (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        Индексация данных...
                      </p>
                    ) : filteredSearch.length === 0 ? (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                        Ничего не найдено
                      </p>
                    ) : (
                      filteredSearch.map((item) => (
                        <Link
                          key={item.id}
                          href={item.href}
                          className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 hover:border-slate-200 hover:bg-slate-50"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery("");
                          }}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {item.label}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {item.description}
                            </p>
                          </div>
                          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
                            {item.kind === "user"
                              ? "Пользователь"
                              : item.kind === "lesson"
                                ? "Урок"
                                : "Курс"}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div ref={notificationsContainerRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setSearchOpen(false);
                }}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-white"
                aria-label="Уведомления"
              >
                <Bell className="h-4 w-4" />
                {totalMenuAlerts > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {totalMenuAlerts > 99 ? "99+" : totalMenuAlerts}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <>
                  <div className="fixed left-2 right-2 top-[4.25rem] z-50 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        Уведомления
                      </p>
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                      >
                        Отметить все
                      </button>
                    </div>

                    <div className="max-h-[calc(100dvh-7.5rem)] space-y-3 overflow-y-auto pr-1">
                      {(["assignments", "courses", "system"] as const).map(
                        (groupKey) => {
                          const entries = notificationGroups[groupKey];
                          if (!entries.length) {
                            return null;
                          }

                          const groupTitle =
                            groupKey === "assignments"
                              ? "Задания"
                              : groupKey === "courses"
                                ? "Курсы"
                                : "Система";

                          return (
                            <section key={groupKey}>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {groupTitle}
                              </p>
                              <div className="space-y-1">
                                {entries.slice(0, 6).map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => void markAsRead(item.id)}
                                    className="w-full rounded-xl border border-slate-200 p-2 text-left hover:bg-slate-50"
                                  >
                                    <p className="text-xs font-semibold text-slate-900">
                                      {localizeNotificationTitle(item.title)}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                                      {localizeNotificationBody(item.body)}
                                    </p>
                                    <div className="mt-1 flex items-center justify-between">
                                      <span className="text-[11px] text-slate-500">
                                        {localizeNotificationType(item.type)}
                                      </span>
                                      <span className="text-[11px] text-slate-400">
                                        {formatNotificationDate(item.createdAt)}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </section>
                          );
                        },
                      )}

                      {!notifications.length ? (
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          Уведомлений пока нет
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="absolute right-0 top-12 hidden w-[360px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:block">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        Уведомления
                      </p>
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                      >
                        Отметить все
                      </button>
                    </div>

                    <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                      {(["assignments", "courses", "system"] as const).map(
                        (groupKey) => {
                          const entries = notificationGroups[groupKey];
                          if (!entries.length) {
                            return null;
                          }

                          const groupTitle =
                            groupKey === "assignments"
                              ? "Задания"
                              : groupKey === "courses"
                                ? "Курсы"
                                : "Система";

                          return (
                            <section key={groupKey}>
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {groupTitle}
                              </p>
                              <div className="space-y-1">
                                {entries.slice(0, 6).map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => void markAsRead(item.id)}
                                    className="w-full rounded-xl border border-slate-200 p-2 text-left hover:bg-slate-50"
                                  >
                                    <p className="text-xs font-semibold text-slate-900">
                                      {localizeNotificationTitle(item.title)}
                                    </p>
                                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                                      {localizeNotificationBody(item.body)}
                                    </p>
                                    <div className="mt-1 flex items-center justify-between">
                                      <span className="text-[11px] text-slate-500">
                                        {localizeNotificationType(item.type)}
                                      </span>
                                      <span className="text-[11px] text-slate-400">
                                        {formatNotificationDate(item.createdAt)}
                                      </span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </section>
                          );
                        },
                      )}

                      {!notifications.length ? (
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          Уведомлений пока нет
                        </p>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-2 py-1 shadow-sm">
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">
                {profileName}
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">
                {initials}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 sm:inline" />
            </div>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Выход</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 overflow-y-auto border-r border-slate-200/70 bg-white/70 p-4 backdrop-blur-xl lg:block">
          <nav className="space-y-1">
            {props.navItems.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(item.href, item.exact);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl border border-slate-900 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
                      : "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-200 hover:bg-white"
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-[calc(100vh-4rem)] flex-1 p-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:p-5 md:pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:p-6 lg:pb-6">
          <nav className="mb-4 flex items-center gap-1 overflow-x-auto pb-1 text-xs text-slate-500">
            {breadcrumbs.map((item, index) => (
              <div
                key={`${item.href}-${index}`}
                className="flex shrink-0 items-center gap-1"
              >
                {index > 0 ? <span>/</span> : null}
                {item.isCurrent ? (
                  <span className="font-semibold text-slate-700">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="hover:text-slate-700 hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
          {props.children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur lg:hidden">
        <div
          className={
            hasFixedMobileButtons
              ? "mx-auto grid w-full max-w-[1440px] items-stretch gap-1 px-1 pt-1"
              : "mx-auto flex max-w-[1440px] items-stretch gap-1 overflow-x-auto px-1 pt-1 [scrollbar-width:none]"
          }
          style={
            hasFixedMobileButtons
              ? {
                  gridTemplateColumns: `repeat(${props.navItems.length}, minmax(0, 1fr))`,
                }
              : undefined
          }
        >
          {props.navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(item.href, item.exact);
            const showAlertDot = shouldShowAlertDot(item.href);
            const showUnreadBadge =
              item.href.endsWith("/notifications") && unreadCount > 0;

            return (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                className={
                  hasFixedMobileButtons
                    ? "flex min-h-[56px] min-w-0 w-full flex-col items-center justify-center gap-1 rounded-lg border-0 px-1 py-2 text-center"
                    : "flex min-h-[56px] min-w-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-0 px-1 py-2 text-center"
                }
              >
                <div
                  className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    isActive ? "bg-slate-900" : "bg-transparent"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? "text-white" : "text-slate-600"
                    }`}
                  />
                  {showAlertDot ? (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-rose-500" />
                  ) : null}
                  {showUnreadBadge ? (
                    <span className="absolute -right-2 -top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  ) : null}
                </div>
                <span
                  className={`text-[9px] font-semibold leading-3 transition-colors ${
                    isActive ? "text-slate-900" : "text-slate-600"
                  }`}
                >
                  <span className="block max-w-full truncate">
                    {item.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="h-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden" />
    </div>
  );
}
