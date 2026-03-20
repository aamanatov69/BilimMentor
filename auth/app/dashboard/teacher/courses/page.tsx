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
  const [editCourseId, setEditCourseId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLevel, setEditLevel] = useState<CourseItem["level"]>("beginner");
  const [busyCourseId, setBusyCourseId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const isCreated = searchParams.get("created") === "1";

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

  useEffect(() => {
    void loadCourses();
  }, []);

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

  const openEditModal = (course: CourseItem) => {
    setEditCourseId(course.id);
    setEditTitle(course.title);
    setEditLevel(course.level);
    setError("");
  };

  const closeEditModal = () => {
    setEditCourseId("");
    setEditTitle("");
    setEditLevel("beginner");
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

  return (
    <main className="p-0 md:rounded-xl md:border md:border-slate-200 md:bg-white md:p-4 md:shadow-sm lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Курсы</h1>
        <Link
          href="/dashboard/teacher/courses/new"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Создать новый курс
        </Link>
      </div>

      {isCreated ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Курс успешно сохранен и добавлен в список.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {courses.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Курсы пока не добавлены.</p>
      ) : null}

      <div className="mt-4 space-y-3 md:hidden">
        {courses.map((course) => (
          <article
            key={`mobile-${course.id}`}
            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <Link
                href={`/dashboard/teacher/courses/${course.id}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex h-11 w-11 min-w-fit items-center justify-center rounded-lg bg-slate-700 text-white">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-5 text-slate-900">
                    {course.title}
                  </p>
                  <p className="mt-1 text-lg font-medium leading-none text-slate-700">
                    {course.studentsCount ?? 0} студентов
                  </p>
                </div>
              </Link>
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
          </article>
        ))}
      </div>

      <div className="mobile-scroll mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-left text-sm font-medium text-slate-600">
              <th className="px-4 py-3">Курс</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Студент</th>
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
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(course.createdAt).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/teacher/courses/${course.id}`}
                      className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Просмотр
                    </Link>
                    {course.isPublished ? (
                      <button
                        className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        disabled={busyCourseId === course.id}
                        onClick={() => void updateVisibility(course.id, false)}
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

      {editCourseId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
          <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">Просмотр курса</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Название курса
              </label>
              <p className="mt-1 text-sm text-slate-900">{editTitle}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Уровень
              </label>
              <p className="mt-1 text-sm text-slate-900">
                {getCourseLevelLabel(editLevel)}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
