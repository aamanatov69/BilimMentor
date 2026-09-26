import { StatusBadge } from "@/components/ui/status-badge";
import { BookOpen, Share2, Trash2 } from "lucide-react";

type CourseItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  isPublished: boolean;
  createdAt: string;
  studentsCount?: number;
  modules?: Array<Record<string, unknown>>;
};

type CourseListSectionProps = {
  displayedCourses: CourseItem[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  statusFilter: "all" | "published" | "draft";
  onStatusFilterChange: (value: "all" | "published" | "draft") => void;
  sortBy: "newest" | "students" | "title";
  onSortByChange: (value: "newest" | "students" | "title") => void;
  getLessonsCount: (course: CourseItem) => number;
  busyCourseId: string;
  endCourseId: string;
  isEndingCourse: boolean;
  onLoadCourseLessons: (courseId: string, courseTitle: string) => void;
  onUpdateVisibility: (courseId: string, isPublished: boolean) => void;
  onOpenEndCourseModal: (courseId: string, courseTitle: string) => void;
  onOpenDeleteModal: (courseId: string, courseTitle: string) => void;
  onOpenShareModal: (courseId: string, courseTitle: string) => void;
};

export function CourseListSection({
  displayedCourses,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
  getLessonsCount,
  busyCourseId,
  endCourseId,
  isEndingCourse,
  onLoadCourseLessons,
  onUpdateVisibility,
  onOpenEndCourseModal,
  onOpenDeleteModal,
  onOpenShareModal,
}: CourseListSectionProps) {
  return (
    <>
      <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 md:grid-cols-[1.4fr_auto_auto]">
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Поиск по курсам"
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              onStatusFilterChange(
                event.target.value as "all" | "published" | "draft",
              )
            }
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
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
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
          >
            <option value="newest">Сначала новые</option>
            <option value="students">По числу студентов</option>
            <option value="title">По названию</option>
          </select>
        </div>
      </section>

      {displayedCourses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Курсы пока не добавлены.</p>
      ) : null}

      <div className="mt-4 space-y-3 md:hidden">
        {displayedCourses.map((course) => (
          <article
            key={`mobile-${course.id}`}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onLoadCourseLessons(course.id, course.title)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-80"
              >
                <div className="flex h-11 w-11 min-w-fit items-center justify-center rounded-lg bg-slate-700 text-white">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-5 text-slate-900">
                    {course.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-700">
                    <p>{course.studentsCount ?? 0} студентов</p>
                    <p>{getLessonsCount(course)} уроков</p>
                  </div>
                </div>
              </button>
              <StatusBadge status={course.isPublished ? "published" : "hidden"} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onLoadCourseLessons(course.id, course.title)}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Просмотр уроков
              </button>
              <button
                type="button"
                onClick={() => onOpenShareModal(course.id, course.title)}
                className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                <Share2 className="h-3.5 w-3.5" />
                Поделиться
              </button>
              {course.isPublished ? (
                <button
                  type="button"
                  onClick={() => onOpenEndCourseModal(course.id, course.title)}
                  disabled={isEndingCourse && endCourseId === course.id}
                  className="rounded border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  Конец курса
                </button>
              ) : null}
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
                  <StatusBadge status={course.isPublished ? "published" : "hidden"} />
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {course.studentsCount ?? 0}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {getLessonsCount(course)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(course.createdAt).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        onLoadCourseLessons(course.id, course.title)
                      }
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Просмотр
                    </button>
                    {course.isPublished ? (
                      <button
                        className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        disabled={busyCourseId === course.id}
                        onClick={() => onUpdateVisibility(course.id, false)}
                      >
                        Скрыть
                      </button>
                    ) : (
                      <button
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
                        disabled={isEndingCourse && endCourseId === course.id}
                        onClick={() =>
                          onOpenEndCourseModal(course.id, course.title)
                        }
                      >
                        Конец курса
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        onOpenShareModal(course.id, course.title)
                      }
                      className="inline-flex items-center justify-center rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 hover:bg-sky-100"
                      aria-label="Поделиться курсом"
                      title="Поделиться"
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
  );
}
