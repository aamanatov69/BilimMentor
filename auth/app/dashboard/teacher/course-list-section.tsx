import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";
import { BookOpen, Share2, Trash2 } from "lucide-react";
import type { TeacherOverviewCourse } from "./page";

type CourseListSectionProps = {
  courses: TeacherOverviewCourse[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: "all" | "published" | "draft";
  onStatusFilterChange: (value: "all" | "published" | "draft") => void;
  sortBy: "newest" | "students" | "title";
  onSortByChange: (value: "newest" | "students" | "title") => void;
  busyCourseId: string;
  endCourseId: string;
  isEndingCourse: boolean;
  deleteCourseId: string;
  isDeletingCourse: boolean;
  shareCourseId: string;
  onUpdateVisibility: (courseId: string, isPublished: boolean) => void;
  onOpenEndCourseModal: (courseId: string, courseTitle: string) => void;
  onOpenDeleteModal: (courseId: string, courseTitle: string) => void;
  onOpenShareModal: (courseId: string, courseTitle: string) => void;
};

function getLessonsCount(course: TeacherOverviewCourse) {
  const modules = Array.isArray(course.modules) ? course.modules : [];
  return modules.filter(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      String((item as Record<string, unknown>).type ?? "").toLowerCase() ===
        "lesson",
  ).length;
}

export function CourseListSection({
  courses,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  busyCourseId,
  endCourseId,
  isEndingCourse,
  deleteCourseId,
  isDeletingCourse,
  shareCourseId,
  onUpdateVisibility,
  onOpenEndCourseModal,
  onOpenDeleteModal,
  onOpenShareModal,
}: CourseListSectionProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Курсы</h2>
        <Link
          href="/dashboard/teacher/courses/new?reset=1"
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          Создать новый курс
        </Link>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[1.4fr_auto_auto]">
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Поиск по курсам"
          className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatusFilterChange(
              event.target.value as "all" | "published" | "draft",
            )
          }
          className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
        >
          <option value="all">Все статусы</option>
          <option value="published">Опубликованные</option>
          <option value="draft">Скрытые</option>
        </select>
        <select
          value={sortBy}
          onChange={(event) =>
            onSortByChange(
              event.target.value as "newest" | "students" | "title",
            )
          }
          className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
        >
          <option value="newest">Сначала новые</option>
          <option value="students">По числу студентов</option>
          <option value="title">По названию</option>
        </select>
      </div>

      {courses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Курсы пока не добавлены.</p>
      ) : (
        <>
          <div className="mt-4 space-y-3 md:hidden">
            {courses.map((course) => (
              <article
                key={`mobile-${course.id}`}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {course.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {course.createdAt
                        ? new Date(course.createdAt).toLocaleDateString(
                            "ru-RU",
                          )
                        : "Дата не указана"}
                    </p>
                  </div>

                  <StatusBadge status={course.isPublished ? "published" : "hidden"} />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-700 min-[360px]:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Студенты
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {course.studentsCount ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Уроки
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {getLessonsCount(course)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                  <Link
                    href={`/dashboard/teacher/courses?course=${course.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Просмотр
                  </Link>

                  {course.isPublished ? (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                      disabled={busyCourseId === course.id}
                      onClick={() => onUpdateVisibility(course.id, false)}
                    >
                      Скрыть
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      disabled={busyCourseId === course.id}
                      onClick={() => onUpdateVisibility(course.id, true)}
                    >
                      Опубликовать
                    </button>
                  )}

                  <div className="min-[360px]:col-span-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
                    {course.isPublished ? (
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                        disabled={isEndingCourse && endCourseId === course.id}
                        onClick={() =>
                          onOpenEndCourseModal(course.id, course.title)
                        }
                      >
                        Конец курса
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        Для завершения сначала опубликуйте курс
                      </span>
                    )}

                    <div className="flex items-center gap-2 self-end min-[420px]:self-auto">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                        aria-label="Поделиться курсом"
                        title="Поделиться"
                        disabled={shareCourseId === course.id}
                        onClick={() =>
                          onOpenShareModal(course.id, course.title)
                        }
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenDeleteModal(course.id, course.title)
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        aria-label="Удалить курс"
                        title="Удалить"
                        disabled={
                          isDeletingCourse && deleteCourseId === course.id
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mobile-scroll mt-4 hidden overflow-x-auto md:block">
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
                {courses.map((course) => (
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
                      <StatusBadge status={course.isPublished ? "published" : "hidden"} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {course.studentsCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {getLessonsCount(course)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {course.createdAt
                        ? new Date(course.createdAt).toLocaleDateString(
                            "ru-RU",
                          )
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
                              onUpdateVisibility(course.id, false)
                            }
                          >
                            Скрыть
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            disabled={busyCourseId === course.id}
                            onClick={() => onUpdateVisibility(course.id, true)}
                          >
                            Опубликовать
                          </button>
                        )}
                        {course.isPublished ? (
                          <button
                            type="button"
                            className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            disabled={
                              isEndingCourse && endCourseId === course.id
                            }
                            onClick={() =>
                              onOpenEndCourseModal(course.id, course.title)
                            }
                          >
                            Конец курса
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 hover:bg-sky-100"
                          aria-label="Поделиться курсом"
                          title="Поделиться"
                          disabled={shareCourseId === course.id}
                          onClick={() =>
                            onOpenShareModal(course.id, course.title)
                          }
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDeleteModal(course.id, course.title)
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
        </>
      )}
    </section>
  );
}
