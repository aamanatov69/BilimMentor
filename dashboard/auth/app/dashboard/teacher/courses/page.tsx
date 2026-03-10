"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
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
};

function getCourseLevelLabel(level: CourseItem["level"]) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function TeacherCoursesPage() {
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [error, setError] = useState("");
  const [editCourseId, setEditCourseId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editLevel, setEditLevel] = useState<CourseItem["level"]>("beginner");
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [busyCourseId, setBusyCourseId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const isCreated = searchParams.get("created") === "1";

  const loadCourses = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    const response = await fetch(`${API_URL}/api/teacher/courses`, {
      headers: { Authorization: `Bearer ${token}` },
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
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setBusyCourseId(courseId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/visibility`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
    setEditError("");
    setError("");
  };

  const closeEditModal = () => {
    if (isSavingEdit) {
      return;
    }
    setEditCourseId("");
    setEditTitle("");
    setEditLevel("beginner");
    setEditError("");
  };

  const saveCourseEdit = async () => {
    const token = getTokenFromCookie();
    if (!token || !editCourseId) {
      setEditError("Требуется авторизация");
      return;
    }

    const normalizedTitle = editTitle.trim();
    if (!normalizedTitle) {
      setEditError("Название курса обязательно");
      return;
    }

    setIsSavingEdit(true);
    setEditError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${editCourseId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: normalizedTitle,
            level: editLevel,
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setEditError(data.message ?? "Не удалось обновить курс");
        return;
      }

      setCourses((prev) =>
        prev.map((course) =>
          course.id === editCourseId
            ? {
                ...course,
                title: normalizedTitle,
                level: editLevel,
              }
            : course,
        ),
      );
      closeEditModal();
    } catch {
      setEditError("Ошибка сети при сохранении курса");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const closeDeleteModal = () => {
    if (isDeletingCourse) {
      return;
    }
    setDeleteCourseId("");
    setDeleteCourseTitle("");
  };

  const deleteCourse = async () => {
    const token = getTokenFromCookie();
    if (!token || !deleteCourseId) {
      setError("Требуется авторизация");
      return;
    }

    setIsDeletingCourse(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${deleteCourseId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
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
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          Курсы преподавателя
        </h1>
        <Link
          href="/dashboard/teacher/courses/new"
          className="w-full rounded-md bg-blue-700 px-3 py-2 text-center text-sm text-white hover:bg-blue-800 sm:w-auto"
        >
          Добавить курс
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
            className="rounded-lg border border-slate-200 p-3"
          >
            <p className="font-medium text-slate-900">{course.title}</p>
            <p className="mt-1 text-xs text-slate-600">
              Уровень: {getCourseLevelLabel(course.level)}
            </p>
            <p className="text-xs text-slate-600">
              Статус: {course.isPublished ? "Опубликован" : "Скрыт"}
            </p>

            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link
                href={`/dashboard/teacher/courses/${course.id}`}
                className="text-blue-700 hover:underline"
              >
                Открыть
              </Link>
              <button
                type="button"
                onClick={() => openEditModal(course)}
                className="text-blue-700 hover:underline"
              >
                Редактировать
              </button>
              {course.isPublished ? (
                <button
                  className="text-amber-700 hover:underline"
                  disabled={busyCourseId === course.id}
                  onClick={() => void updateVisibility(course.id, false)}
                >
                  Скрыть
                </button>
              ) : (
                <button
                  className="text-emerald-700 hover:underline"
                  disabled={busyCourseId === course.id}
                  onClick={() => void updateVisibility(course.id, true)}
                >
                  Опубликовать
                </button>
              )}
              <button
                type="button"
                onClick={() => openDeleteModal(course.id, course.title)}
                className="text-rose-600 hover:underline"
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="mobile-scroll mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">Название курса</th>
              <th className="py-2 pr-3 font-medium">Уровень</th>
              <th className="py-2 pr-3 font-medium">Статус</th>
              <th className="py-2 pr-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-b border-slate-100">
                <td className="py-3 pr-3">{course.title}</td>
                <td className="py-3 pr-3">
                  {getCourseLevelLabel(course.level)}
                </td>
                <td className="py-3 pr-3">
                  {course.isPublished ? "Опубликован" : "Скрыт"}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/dashboard/teacher/courses/${course.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      Открыть
                    </Link>
                    <button
                      type="button"
                      onClick={() => openEditModal(course)}
                      className="text-blue-700 hover:underline"
                    >
                      Редактировать
                    </button>
                    {course.isPublished ? (
                      <button
                        className="text-amber-700 hover:underline"
                        disabled={busyCourseId === course.id}
                        onClick={() => void updateVisibility(course.id, false)}
                      >
                        Скрыть
                      </button>
                    ) : (
                      <button
                        className="text-emerald-700 hover:underline"
                        disabled={busyCourseId === course.id}
                        onClick={() => void updateVisibility(course.id, true)}
                      >
                        Опубликовать
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDeleteModal(course.id, course.title)}
                      className="text-rose-600 hover:underline"
                    >
                      Удалить
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
              <h2 className="text-lg font-semibold">Редактирование курса</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <input
                className="rounded border border-slate-300 px-3 py-2"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                placeholder="Название"
              />
              <select
                className="rounded border border-slate-300 px-3 py-2"
                value={editLevel}
                onChange={(event) =>
                  setEditLevel(event.target.value as CourseItem["level"])
                }
              >
                <option value="beginner">Начальный</option>
                <option value="intermediate">Средний</option>
                <option value="advanced">Продвинутый</option>
              </select>

              {editError ? (
                <p className="text-sm text-rose-600">{editError}</p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveCourseEdit()}
                  disabled={isSavingEdit}
                  className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {isSavingEdit ? "Сохранение..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
