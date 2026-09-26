"use client";

import { apiFetch } from "@/lib/api-client";

import { Bell, ChevronDown, LogOut, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { NotificationsPanelContent } from "./notifications-panel-content";
import { SearchDropdown } from "./search-dropdown";
import { SessionRecovery } from "./session-recovery";
import { apiJson } from "@/lib/api-client";

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
  const [profileId, setProfileId] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoaded, setSearchLoaded] = useState(false);
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
      const data = await apiJson<MeResponse>("/api/me");
      if (data.user?.id) setProfileId(data.user.id);
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
        apiFetch(`${API_URL}/api/notifications`, { credentials: "include" }),
        apiFetch(`${API_URL}/api/notifications/unread-count`, {
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
        const response = await apiFetch(`${API_URL}/api/student/assignments`, {
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
        const response = await apiFetch(`${API_URL}/api/teacher/grades`, {
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

      const response = await apiFetch(`${API_URL}/api/admin/reports`, {
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
    setSearchLoaded(true);
    setSearchLoading(true);
    try {
      if (props.role === "student") {
        const [discoverResponse, enrolledResponse] = await Promise.all([
          apiFetch(`${API_URL}/api/student/courses/discover`, {
            credentials: "include",
          }),
          apiFetch(`${API_URL}/api/student/courses`, { credentials: "include" }),
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
              href: `/dashboard/student/courses?tab=all&course=${encodeURIComponent(course.id)}`,
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
                href: `/dashboard/student/courses/${course.id}?lesson=${encodeURIComponent(lessonId)}`,
                kind: "lesson",
              });
            }
          }
        }

        setSearchResults(combined);
        return;
      }

      if (props.role === "teacher") {
        const response = await apiFetch(`${API_URL}/api/teacher/courses`, {
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
            href: `/dashboard/teacher/courses?course=${encodeURIComponent(course.id)}`,
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
              href: `/dashboard/teacher/courses?course=${encodeURIComponent(course.id)}#lesson-${encodeURIComponent(lessonId)}`,
              kind: "lesson",
            });
          }
        }

        setSearchResults(items);
        return;
      }

      const [coursesResponse, usersResponse] = await Promise.all([
        apiFetch(`${API_URL}/api/courses`, { credentials: "include" }),
        apiFetch(`${API_URL}/api/admin/users`, { credentials: "include" }),
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
            href: `/dashboard/admin/courses/${encodeURIComponent(course.id)}/edit`,
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
              href: `/dashboard/admin/courses/${encodeURIComponent(course.id)}/edit#lesson-${encodeURIComponent(lessonId)}`,
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
            href: `/dashboard/admin/users#user-${encodeURIComponent(user.id)}`,
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
    if (!searchOpen) {
      setSearchLoaded(false);
      return;
    }
    if (searchLoaded || searchLoading) {
      return;
    }
    void loadSearchIndex();
  }, [searchOpen, searchLoaded, searchLoading]);

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
    await apiFetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.replace("/");
  };

  const markAsRead = async (notificationId: string) => {
    await apiFetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: "PATCH",
      credentials: "include",
    });
    await Promise.all([loadNotifications(), loadRoleAlerts()]);
  };

  const markAllRead = async () => {
    await apiFetch(`${API_URL}/api/notifications/read/all`, {
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
            <SearchDropdown
              containerRef={searchContainerRef}
              searchOpen={searchOpen}
              onToggleOpen={() => {
                setSearchOpen((current) => !current);
                setNotificationsOpen(false);
              }}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              searchLoading={searchLoading}
              filteredSearch={filteredSearch}
              onSelectResult={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            />

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
                    <NotificationsPanelContent
                      notifications={notifications}
                      notificationGroups={notificationGroups}
                      onMarkAsRead={(id) => void markAsRead(id)}
                      onMarkAllRead={() => void markAllRead()}
                      listClassName="max-h-[calc(100dvh-7.5rem)] space-y-3 overflow-y-auto pr-1"
                    />
                  </div>

                  <div className="absolute right-0 top-12 hidden w-[360px] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:block">
                    <NotificationsPanelContent
                      notifications={notifications}
                      notificationGroups={notificationGroups}
                      onMarkAsRead={(id) => void markAsRead(id)}
                      onMarkAllRead={() => void markAllRead()}
                      listClassName="max-h-[360px] space-y-3 overflow-y-auto pr-1"
                    />
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
                  aria-current={active ? "page" : undefined}
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

        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 p-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:p-5 md:pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:p-6 lg:pb-6">
          <nav aria-label="Путь страницы" className="mb-4 flex items-center gap-1 overflow-x-auto pb-1 text-xs text-slate-500">
            {breadcrumbs.map((item, index) => (
              <div
                key={`${item.href}-${index}`}
                className="flex shrink-0 items-center gap-1"
              >
                {index > 0 ? <span>/</span> : null}
                {item.isCurrent ? (
                  <span aria-current="page" className="font-semibold text-slate-700">
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
          <SessionRecovery userId={profileId} />
          {props.children}
        </main>
      </div>

      <MobileBottomNav
        navItems={props.navItems}
        isActivePath={isActivePath}
        shouldShowAlertDot={shouldShowAlertDot}
        unreadCount={unreadCount}
      />

      <div className="h-[calc(6rem+env(safe-area-inset-bottom))] lg:hidden" />
    </div>
  );
}
