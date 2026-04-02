"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  BookOpen,
  ClipboardCheck,
  Share2,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type OverviewResponse = {
  summary?: {
    courses?: number;
    studentsEnrolled?: number;
    assignmentsToGrade?: number;
    pendingRequests?: number;
  };
  courses?: Array<{
    id: string;
    title: string;
    category?: string | null;
    progress?: number | null;
    isPublished?: boolean;
    createdAt?: string;
    modules?: Array<Record<string, unknown>>;
    studentsCount?: number;
  }>;
};

export default function TeacherDashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "students" | "title">(
    "newest",
  );
  const [busyCourseId, setBusyCourseId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [shareCourseId, setShareCourseId] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const overviewResponse = await fetch(
          `${API_URL}/api/teacher/overview`,
          {
            credentials: "include",
          },
        );

        const overviewData =
          (await overviewResponse.json()) as OverviewResponse & {
            message?: string;
          };

        if (!overviewResponse.ok) {
          setError(
            overviewData.message ??
              "Не удалось загрузить рабочее место преподавателя",
          );
          return;
        }

        setOverview(overviewData);
      } catch {
        setError("Ошибка сети");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const cards = useMemo(
    () => [
      {
        title: "Курсы",
        value: overview?.summary?.courses ?? 0,
        icon: BookOpen,
        hint: "Активных курсов",
        color: "text-sky-700 bg-sky-100",
      },
      {
        title: "Студенты",
        value: overview?.summary?.studentsEnrolled ?? 0,
        icon: Users,
        hint: "Учатся у вас",
        color: "text-emerald-700 bg-emerald-100",
      },
      {
        title: "Новые заявки",
        value: overview?.summary?.pendingRequests ?? 0,
        icon: ClipboardCheck,
        hint: "Требуют ответа",
        color: "text-amber-700 bg-amber-100",
      },
      {
        title: "Задания на проверку",
        value: overview?.summary?.assignmentsToGrade ?? 0,
        icon: Star,
        hint: "Работ ожидают оценку",
        color: "text-rose-700 bg-rose-100",
      },
    ],
    [overview],
  );

  const performanceRows = useMemo(
    () =>
      (overview?.courses ?? []).slice(0, 8).map((course) => {
        const completion = Math.max(
          0,
          Math.min(100, Number(course.progress ?? 0)),
        );

        let statusLabel = "Нужно усилить контроль";
        if (completion >= 75) {
          statusLabel = "Высокая динамика";
        } else if (completion >= 50) {
          statusLabel = "Стабильная динамика";
        }

        return {
          id: course.id,
          title: course.title,
          students: course.studentsCount ?? 0,
          completion,
          statusLabel,
        };
      }),
    [overview?.courses],
  );

  const getLessonsCount = (
    course: NonNullable<OverviewResponse["courses"]>[number],
  ) => {
    const modules = Array.isArray(course.modules) ? course.modules : [];
    return modules.filter(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        String((item as Record<string, unknown>).type ?? "").toLowerCase() ===
          "lesson",
    ).length;
  };

  const displayedCourses = useMemo(() => {
    return [...(overview?.courses ?? [])]
      .filter((course) => {
        if (statusFilter === "published" && !course.isPublished) {
          return false;
        }

        if (statusFilter === "draft" && course.isPublished) {
          return false;
        }

        const text = `${course.title} ${course.category ?? ""}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase().trim());
      })
      .sort((a, b) => {
        if (sortBy === "students") {
          return (b.studentsCount ?? 0) - (a.studentsCount ?? 0);
        }

        if (sortBy === "title") {
          return a.title.localeCompare(b.title, "ru");
        }

        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
      });
  }, [overview?.courses, searchQuery, sortBy, statusFilter]);

  const updateVisibility = async (courseId: string, isPublished: boolean) => {
    setBusyCourseId(courseId);
    setError("");
    setInfo("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/visibility`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isPublished }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось изменить статус курса");
        return;
      }

      setOverview((prev) => {
        if (!prev?.courses) {
          return prev;
        }

        return {
          ...prev,
          courses: prev.courses.map((course) =>
            course.id === courseId ? { ...course, isPublished } : course,
          ),
        };
      });
    } catch {
      setError("Ошибка сети при изменении статуса курса");
    } finally {
      setBusyCourseId("");
    }
  };

  const openDeleteModal = (courseId: string, courseTitle: string) => {
    setDeleteCourseId(courseId);
    setDeleteCourseTitle(courseTitle);
    setError("");
    setInfo("");
  };

  const closeDeleteModal = () => {
    if (isDeletingCourse) {
      return;
    }

    setDeleteCourseId("");
    setDeleteCourseTitle("");
  };

  const deleteCourse = async () => {
    if (!deleteCourseId) {
      return;
    }

    setIsDeletingCourse(true);
    setError("");
    setInfo("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${deleteCourseId}`,
        {
          credentials: "include",
          method: "DELETE",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить курс");
        return;
      }

      setOverview((prev) => {
        if (!prev?.courses) {
          return prev;
        }

        const nextCourses = prev.courses.filter(
          (course) => course.id !== deleteCourseId,
        );
        const nextSummary = {
          ...(prev.summary ?? {}),
          courses: Math.max(0, nextCourses.length),
        };

        return {
          ...prev,
          summary: nextSummary,
          courses: nextCourses,
        };
      });

      setDeleteCourseId("");
      setDeleteCourseTitle("");
      setInfo("Курс удален");
    } catch {
      setError("Ошибка сети при удалении курса");
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const shareCourseInvite = async (courseId: string, courseTitle: string) => {
    setShareCourseId(courseId);
    setError("");
    setInfo("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/share-invite`,
        {
          credentials: "include",
        },
      );

      const data = (await response.json()) as {
        inviteToken?: string;
        message?: string;
      };

      if (!response.ok || !data.inviteToken) {
        setError(data.message ?? "Не удалось создать ссылку для курса");
        return;
      }

      const appBase = window.location.origin.replace(/\/$/, "");
      const registerUrl = `${appBase}/register?courseInvite=${encodeURIComponent(data.inviteToken)}`;

      try {
        await navigator.clipboard.writeText(registerUrl);
        setInfo(`Ссылка для курса "${courseTitle}" скопирована`);
      } catch {
        setInfo(`Ссылка: ${registerUrl}`);
      }
    } catch {
      setError("Ошибка сети при создании ссылки для курса");
    } finally {
      setShareCourseId("");
    }
  };

  const averageCompletion = useMemo(() => {
    if (!performanceRows.length) {
      return 0;
    }

    const total = performanceRows.reduce(
      (acc, item) => acc + item.completion,
      0,
    );
    return Math.round(total / performanceRows.length);
  }, [performanceRows]);

  const studentsEnrolled = overview?.summary?.studentsEnrolled ?? 0;
  const assignmentsToGrade = overview?.summary?.assignmentsToGrade ?? 0;
  const pendingRequests = overview?.summary?.pendingRequests ?? 0;

  return (
    <main className="space-y-5">
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {card.title}
                </p>
                <span className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {loading ? "..." : card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Курсы</h2>
          <Link
            href="/dashboard/teacher/courses/new?reset=1"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Создать новый курс
          </Link>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-[1.4fr_auto_auto]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по курсам"
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "published" | "draft",
              )
            }
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
          >
            <option value="all">Все статусы</option>
            <option value="published">Опубликованные</option>
            <option value="draft">Черновики</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "newest" | "students" | "title")
            }
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
          >
            <option value="newest">Сначала новые</option>
            <option value="students">По числу студентов</option>
            <option value="title">По названию</option>
          </select>
        </div>

        {displayedCourses.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Курсы пока не добавлены.
          </p>
        ) : (
          <div className="mobile-scroll mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-sm font-medium text-slate-600">
                  <th className="px-4 py-3">Курс</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Студент</th>
                  <th className="px-4 py-3">Уроков</th>
                  <th className="px-4 py-3">Дата создания</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {displayedCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-100">
                          <BookOpen className="h-5 w-5 text-blue-700" />
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                          {course.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {course.isPublished ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          Черновик
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {course.studentsCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {getLessonsCount(course)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {course.createdAt
                        ? new Date(course.createdAt).toLocaleDateString("ru-RU")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/dashboard/teacher/courses?course=${course.id}`}
                          className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Просмотр
                        </Link>
                        {course.isPublished ? (
                          <button
                            type="button"
                            className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                            disabled={busyCourseId === course.id}
                            onClick={() =>
                              void updateVisibility(course.id, false)
                            }
                          >
                            Скрыть
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            disabled={busyCourseId === course.id}
                            onClick={() =>
                              void updateVisibility(course.id, true)
                            }
                          >
                            Опубликовать
                          </button>
                        )}
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 hover:bg-sky-100"
                          aria-label="Поделиться курсом"
                          title="Поделиться"
                          disabled={shareCourseId === course.id}
                          onClick={() =>
                            void shareCourseInvite(course.id, course.title)
                          }
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openDeleteModal(course.id, course.title)
                          }
                          className="inline-flex items-center justify-center rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700 hover:bg-rose-100"
                          aria-label="Удалить курс"
                          title="Удалить"
                          disabled={
                            isDeletingCourse && deleteCourseId === course.id
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <article className="dashboard-rise rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Успеваемость</h2>
          <p className="mt-1 text-sm text-slate-600">
            График прогресса студентов по вашим курсам и текущая учебная
            нагрузка.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Средний прогресс
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "..." : `${averageCompletion}%`}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Студенты
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "..." : studentsEnrolled}
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                На проверке
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {loading ? "..." : assignmentsToGrade}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Заявки: {loading ? "..." : pendingRequests}
              </p>
            </article>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {performanceRows.length ? (
              <div className="flex h-48 items-end gap-2">
                {performanceRows.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex h-32 w-full items-end rounded-md bg-white px-1 py-1">
                      <div
                        className="w-full rounded-md bg-gradient-to-t from-cyan-500 to-emerald-500"
                        style={{ height: `${Math.max(item.completion, 6)}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-700">
                      {item.completion}%
                    </p>
                    <p
                      className="w-full truncate text-center text-[10px] text-slate-500"
                      title={item.title}
                    >
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Пока нет данных для графика успеваемости. Добавьте курс и
                дождитесь первой активности студентов.
              </p>
            )}
          </div>
        </article>
      </section>

      <ConfirmModal
        isOpen={Boolean(deleteCourseId)}
        title="Удалить курс?"
        description={
          deleteCourseTitle
            ? `Курс "${deleteCourseTitle}" будет удален без возможности восстановления.`
            : "Курс будет удален без возможности восстановления."
        }
        confirmText="Удалить"
        cancelText="Отмена"
        tone="danger"
        isBusy={isDeletingCourse}
        onCancel={closeDeleteModal}
        onConfirm={() => void deleteCourse()}
      />
    </main>
  );
}
