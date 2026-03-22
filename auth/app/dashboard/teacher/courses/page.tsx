"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { BookOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

type CourseLessonItem = {
  id: string;
  title: string;
  isVisibleToStudents: boolean;
};

function getCourseLevelLabel(level: CourseItem["level"]) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

export default function TeacherCoursesPage() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [error, setError] = useState("");
  const [busyCourseId, setBusyCourseId] = useState("");
  const [busyLessonId, setBusyLessonId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [viewCourseId, setViewCourseId] = useState("");
  const [viewCourseTitle, setViewCourseTitle] = useState("");
  const [viewLessons, setViewLessons] = useState<CourseLessonItem[]>([]);
  const [isLoadingLessons, setIsLoadingLessons] = useState(false);
  const [deleteLessonCourseId, setDeleteLessonCourseId] = useState("");
  const [deleteLessonId, setDeleteLessonId] = useState("");
  const [deleteLessonTitle, setDeleteLessonTitle] = useState("");
  const isCreated = searchParams.get("created") === "1";

  const mapLessons = (modules: Array<Record<string, unknown>> | undefined) => {
    const list = Array.isArray(modules) ? modules : [];
    return list
      .filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          String(item.type ?? "").toLowerCase() === "lesson",
      )
      .map((item) => ({
        id: String(item.id ?? ""),
        title: String(item.title ?? "Без названия"),
        isVisibleToStudents: item.isVisibleToStudents !== false,
      }))
      .filter((lesson) => Boolean(lesson.id));
  };

  const getLessonsCount = (course: CourseItem) =>
    mapLessons(course.modules).length;

  const loadCourses = async () => {
    const response = await fetch(`${API_URL}/api/teacher/courses`, {
      credentials: "include",
    });

    const data = (await response.json()) as {
      courses?: CourseItem[];
      message?: string;
    };

    if (!response.ok) {
      setError(data.message ?? "Не удалось загрузить курсы");
      return;
    }

    setCourses(data.courses ?? []);
  };

  const loadCourseLessons = async (courseId: string, courseTitle: string) => {
    setViewCourseId(courseId);
    setViewCourseTitle(courseTitle);
    setIsLoadingLessons(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/details`,
        {
          credentials: "include",
        },
      );

      const data = (await response.json()) as {
        course?: { modules?: Array<Record<string, unknown>> };
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось загрузить уроки курса");
        setViewLessons([]);
        return;
      }

      setViewLessons(mapLessons(data.course?.modules));
    } catch {
      setError("Ошибка сети при загрузке уроков");
      setViewLessons([]);
    } finally {
      setIsLoadingLessons(false);
    }
  };

  useEffect(() => {
    void loadCourses();
  }, []);

  useEffect(() => {
    // Auto-open lessons view if course parameter is present
    const courseId = searchParams.get("course")?.trim() ?? "";
    if (courseId && courses.length > 0) {
      const course = courses.find((c) => c.id === courseId);
      if (course) {
        void loadCourseLessons(courseId, course.title);
      }
    }
  }, [searchParams, courses]);

  const updateVisibility = async (courseId: string, isPublished: boolean) => {
    setBusyCourseId(courseId);
    setError("");

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

      await loadCourses();
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
  };

  const closeDeleteModal = () => {
    if (isDeletingCourse) {
      return;
    }
    setDeleteCourseId("");
    setDeleteCourseTitle("");
  };

  const closeViewModal = () => {
    if (busyLessonId) {
      return;
    }

    setViewCourseId("");
    setViewCourseTitle("");
    setViewLessons([]);
  };

  const openDeleteLessonModal = (
    courseId: string,
    lessonId: string,
    lessonTitle: string,
  ) => {
    setDeleteLessonCourseId(courseId);
    setDeleteLessonId(lessonId);
    setDeleteLessonTitle(lessonTitle);
    setError("");
  };

  const closeDeleteLessonModal = () => {
    if (busyLessonId) {
      return;
    }

    setDeleteLessonCourseId("");
    setDeleteLessonId("");
    setDeleteLessonTitle("");
  };

  const deleteCourse = async () => {
    if (!deleteCourseId) {
      return;
    }

    setIsDeletingCourse(true);
    setError("");
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

      setDeleteCourseId("");
      setDeleteCourseTitle("");
      await loadCourses();
    } catch {
      setError("Ошибка сети при удалении курса");
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const toggleLessonVisibility = async (
    courseId: string,
    lesson: CourseLessonItem,
  ) => {
    setBusyLessonId(lesson.id);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/lessons/${lesson.id}/visibility`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            isVisibleToStudents: !lesson.isVisibleToStudents,
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось изменить статус урока");
        return;
      }

      await Promise.all([
        loadCourses(),
        loadCourseLessons(courseId, viewCourseTitle),
      ]);
    } catch {
      setError("Ошибка сети при изменении статуса урока");
    } finally {
      setBusyLessonId("");
    }
  };

  const deleteLesson = async () => {
    if (!deleteLessonCourseId || !deleteLessonId) {
      return;
    }

    setBusyLessonId(deleteLessonId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${deleteLessonCourseId}/lessons/${deleteLessonId}`,
        {
          credentials: "include",
          method: "DELETE",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить урок");
        return;
      }

      closeDeleteLessonModal();
      await Promise.all([
        loadCourses(),
        loadCourseLessons(deleteLessonCourseId, viewCourseTitle),
      ]);
    } catch {
      setError("Ошибка сети при удалении урока");
    } finally {
      setBusyLessonId("");
    }
  };

  return (
    <main className="p-0 md:rounded-xl md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {viewCourseId ? "Уроки" : "Курсы"}
        </h1>
        {viewCourseId ? (
          <button
            type="button"
            onClick={closeViewModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Назад к курсам
          </button>
        ) : (
          <Link
            href="/dashboard/teacher/courses/new"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Создать новый курс
          </Link>
        )}
      </div>

      {isCreated ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Курс успешно сохранен и добавлен в список.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {!viewCourseId && courses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Курсы пока не добавлены.</p>
      ) : null}

      {viewCourseId ? (
        <section className="mt-4 space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {viewCourseTitle}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Список уроков выбранного курса.
                </p>
              </div>
              <Link
                href={`/dashboard/teacher/courses/new?courseId=${viewCourseId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap"
              >
                Редактировать курс
              </Link>
            </div>
          </div>

          {isLoadingLessons ? (
            <p className="text-sm text-slate-600">Загрузка уроков...</p>
          ) : viewLessons.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              В этом курсе пока нет уроков.
            </p>
          ) : (
            <div className="space-y-3">
              {viewLessons.map((lesson, index) => (
                <article
                  key={lesson.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        {index + 1}. {lesson.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {lesson.isVisibleToStudents
                          ? "Показан студентам"
                          : "Скрыт от студентов"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/teacher/courses/new?courseId=${viewCourseId}&lessonId=${lesson.id}`}
                        className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Редактировать
                      </Link>
                      <button
                        type="button"
                        disabled={busyLessonId === lesson.id}
                        onClick={() =>
                          void toggleLessonVisibility(viewCourseId, lesson)
                        }
                        className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {lesson.isVisibleToStudents ? "Скрыть" : "Показать"}
                      </button>
                      <button
                        type="button"
                        disabled={busyLessonId === lesson.id}
                        onClick={() =>
                          openDeleteLessonModal(
                            viewCourseId,
                            lesson.id,
                            lesson.title,
                          )
                        }
                        className="inline-flex items-center justify-center rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <Link
            href={`/dashboard/teacher/courses/new?courseId=${viewCourseId}&step=lesson`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            <Plus className="h-4 w-4" />
            Добавить урок
          </Link>
        </section>
      ) : null}

      {!viewCourseId ? (
        <div className="mt-4 space-y-3 md:hidden">
          {courses.map((course) => (
            <article
              key={`mobile-${course.id}`}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void loadCourseLessons(course.id, course.title)
                  }
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
                {course.isPublished ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700 whitespace-nowrap">
                    Активен
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 whitespace-nowrap">
                    Черновик
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void loadCourseLessons(course.id, course.title)
                  }
                  className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Просмотр уроков
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!viewCourseId ? (
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
                    {new Date(course.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          void loadCourseLessons(course.id, course.title)
                        }
                        className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Просмотр
                      </button>
                      {course.isPublished ? (
                        <button
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
                          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          disabled={busyCourseId === course.id}
                          onClick={() => void updateVisibility(course.id, true)}
                        >
                          Опубликовать
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openDeleteModal(course.id, course.title)}
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
      ) : null}

      <ConfirmModal
        isOpen={Boolean(deleteCourseId)}
        title="Удалить курс?"
        description={
          deleteCourseTitle
            ? `Курс \"${deleteCourseTitle}\" будет удален без возможности восстановления.`
            : "Курс будет удален без возможности восстановления."
        }
        confirmText="Подтвердить"
        cancelText="Отмена"
        isBusy={isDeletingCourse}
        onCancel={closeDeleteModal}
        onConfirm={() => void deleteCourse()}
      />

      <ConfirmModal
        isOpen={Boolean(deleteLessonId)}
        title="Удалить урок?"
        description={
          deleteLessonTitle
            ? `Урок \"${deleteLessonTitle}\" будет удален без возможности восстановления.`
            : "Урок будет удален без возможности восстановления."
        }
        confirmText="Подтвердить"
        cancelText="Отмена"
        isBusy={Boolean(busyLessonId)}
        onCancel={closeDeleteLessonModal}
        onConfirm={() => void deleteLesson()}
      />
    </main>
  );
}
