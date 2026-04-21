"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseLevel = "beginner" | "intermediate" | "advanced";

type LessonMaterialRow = {
  id: string;
  title: string;
  type: string;
  url: string;
  canDelete: boolean;
};

type LessonRow = {
  id: string;
  title: string;
  description: string;
  isVisibleToStudents: boolean;
  materials: LessonMaterialRow[];
};

type CourseDetails = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: CourseLevel;
  isPublished: boolean;
  createdAt: string;
  modules?: Array<Record<string, unknown>>;
};

function getCourseLevelLabel(level: CourseLevel) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

function toDatetimeLocalValue(isoValue: string) {
  if (!isoValue) {
    return "";
  }

  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseLessons(modules: Array<Record<string, unknown>> | undefined) {
  const rows = Array.isArray(modules) ? modules : [];

  return rows
    .filter((item) => String(item.type ?? "").toLowerCase() === "lesson")
    .map((item) => {
      const materialsRaw = Array.isArray(item.materials) ? item.materials : [];

      const materials = materialsRaw
        .filter((material) => typeof material === "object" && material !== null)
        .map((material, index) => {
          const record = material as Record<string, unknown>;
          const file =
            typeof record.file === "object" && record.file !== null
              ? (record.file as Record<string, unknown>)
              : null;

          const materialId = String(record.id ?? "").trim();
          const title =
            String(record.title ?? "").trim() ||
            String(file?.name ?? "").trim() ||
            `Материал ${index + 1}`;

          return {
            id: materialId || `material-${index + 1}`,
            title,
            type: String(record.type ?? "material").trim(),
            url: String(record.url ?? "").trim(),
            canDelete: materialId.length > 0,
          } satisfies LessonMaterialRow;
        });

      return {
        id: String(item.id ?? ""),
        title: String(item.title ?? ""),
        description: String(item.description ?? ""),
        isVisibleToStudents: item.isVisibleToStudents !== false,
        materials,
      };
    })
    .filter((item) => item.id.length > 0);
}

export default function AdminEditCoursePage() {
  const params = useParams();
  const courseId = String(params.id ?? "");

  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<CourseLevel>("beginner");
  const [isPublished, setIsPublished] = useState(false);
  const [createdAtLocal, setCreatedAtLocal] = useState("");

  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingLessonId, setSavingLessonId] = useState("");
  const [deletingLessonId, setDeletingLessonId] = useState("");
  const [deletingMaterialKey, setDeletingMaterialKey] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const hasCourse = Boolean(course);

  const loadCourse = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${courseId}/details`,
        {
          credentials: "include",
        },
      );

      const data = (await response.json()) as {
        course?: CourseDetails;
        message?: string;
      };

      if (!response.ok || !data.course) {
        setError(data.message ?? "Не удалось загрузить курс");
        return;
      }

      setCourse(data.course);
      setLessons(parseLessons(data.course.modules));
      setTitle(data.course.title);
      setCategory(data.course.category || "General");
      setDescription(data.course.description || "");
      setLevel(data.course.level);
      setIsPublished(Boolean(data.course.isPublished));
      setCreatedAtLocal(toDatetimeLocalValue(data.course.createdAt));
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!courseId) {
      setError("Не указан идентификатор курса");
      setLoading(false);
      return;
    }

    void loadCourse();
  }, [courseId]);

  const onSaveCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !description.trim() || !createdAtLocal.trim()) {
      setError("Заполните название, описание и дату создания курса");
      return;
    }

    const parsedCreatedAt = new Date(createdAtLocal);
    if (Number.isNaN(parsedCreatedAt.getTime())) {
      setError("Некорректная дата создания курса");
      return;
    }

    setSavingCourse(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/api/admin/courses/${courseId}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim() || "General",
          description: description.trim(),
          level,
          isPublished,
          createdAt: parsedCreatedAt.toISOString(),
        }),
      });

      const data = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось сохранить курс");
        return;
      }

      setMessage("Курс обновлен");
      await loadCourse();
    } catch {
      setError("Ошибка сети при сохранении курса");
    } finally {
      setSavingCourse(false);
    }
  };

  const updateLessonField = (
    lessonId: string,
    field: "title" | "description",
    value: string,
  ) => {
    setLessons((previous) =>
      previous.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, [field]: value } : lesson,
      ),
    );
  };

  const onSaveLesson = async (lesson: LessonRow) => {
    if (!lesson.title.trim()) {
      setError("Название урока не может быть пустым");
      return;
    }

    setSavingLessonId(lesson.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${courseId}/lessons/${lesson.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: lesson.title.trim(),
            description: lesson.description,
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось обновить урок");
        return;
      }

      setMessage("Урок обновлен");
      await loadCourse();
    } catch {
      setError("Ошибка сети при сохранении урока");
    } finally {
      setSavingLessonId("");
    }
  };

  const onDeleteLesson = async (lessonId: string) => {
    setDeletingLessonId(lessonId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить урок");
        return;
      }

      setMessage("Урок удален");
      await loadCourse();
    } catch {
      setError("Ошибка сети при удалении урока");
    } finally {
      setDeletingLessonId("");
    }
  };

  const onDeleteLessonMaterial = async (
    lessonId: string,
    materialId: string,
  ) => {
    const requestKey = `${lessonId}:${materialId}`;
    setDeletingMaterialKey(requestKey);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${courseId}/lessons/${lessonId}/materials/${materialId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить материал");
        return;
      }

      setMessage("Материал удален");
      await loadCourse();
    } catch {
      setError("Ошибка сети при удалении материала");
    } finally {
      setDeletingMaterialKey("");
    }
  };

  const onCreateLesson = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newLessonTitle.trim()) {
      setError("Введите название нового урока");
      return;
    }

    setCreatingLesson(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${courseId}/lessons`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: newLessonTitle.trim(),
            description: newLessonDescription,
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось добавить урок");
        return;
      }

      setMessage("Урок добавлен");
      setNewLessonTitle("");
      setNewLessonDescription("");
      await loadCourse();
    } catch {
      setError("Ошибка сети при добавлении урока");
    } finally {
      setCreatingLesson(false);
    }
  };

  const publishedLabel = useMemo(
    () => (isPublished ? "Опубликован" : "Черновик"),
    [isPublished],
  );

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          Редактирование курса
        </h1>
        <Link
          href="/dashboard/admin/courses"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Назад к курсам
        </Link>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Загрузка...</p>
      ) : hasCourse ? (
        <>
          <form
            onSubmit={onSaveCourse}
            className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-sm font-semibold text-slate-800">
              Параметры курса
            </p>

            <div>
              <label className="text-sm text-slate-700">Название</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-slate-700">Категория</label>
              <input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-sm text-slate-700">Описание</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-700">Уровень</label>
                <select
                  value={level}
                  onChange={(event) =>
                    setLevel(event.target.value as CourseLevel)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="beginner">
                    {getCourseLevelLabel("beginner")}
                  </option>
                  <option value="intermediate">
                    {getCourseLevelLabel("intermediate")}
                  </option>
                  <option value="advanced">
                    {getCourseLevelLabel("advanced")}
                  </option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-700">
                  Дата создания курса
                </label>
                <input
                  type="datetime-local"
                  value={createdAtLocal}
                  onChange={(event) => setCreatedAtLocal(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(event) => setIsPublished(event.target.checked)}
              />
              Статус: {publishedLabel}
            </label>

            <button
              type="submit"
              disabled={savingCourse}
              className="w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {savingCourse ? "Сохранение..." : "Сохранить курс"}
            </button>
          </form>

          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-800">Уроки курса</p>

            <form
              onSubmit={onCreateLesson}
              className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <input
                value={newLessonTitle}
                onChange={(event) => setNewLessonTitle(event.target.value)}
                placeholder="Название нового урока"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <textarea
                value={newLessonDescription}
                onChange={(event) =>
                  setNewLessonDescription(event.target.value)
                }
                placeholder="Описание нового урока"
                className="min-h-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={creatingLesson}
                className="w-fit rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                {creatingLesson ? "Добавление..." : "Добавить урок"}
              </button>
            </form>

            <div className="mt-3 space-y-3">
              {lessons.length === 0 ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Уроков пока нет.
                </p>
              ) : (
                lessons.map((lesson, index) => (
                  <article
                    key={lesson.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Урок {index + 1}
                    </p>
                    <input
                      value={lesson.title}
                      onChange={(event) =>
                        updateLessonField(
                          lesson.id,
                          "title",
                          event.target.value,
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      value={lesson.description}
                      onChange={(event) =>
                        updateLessonField(
                          lesson.id,
                          "description",
                          event.target.value,
                        )
                      }
                      className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>
                        Видимость для студентов:{" "}
                        {lesson.isVisibleToStudents ? "Да" : "Нет"}
                      </span>
                    </div>
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                      <p className="text-xs font-semibold text-slate-600">
                        Материалы урока
                      </p>
                      {lesson.materials.length === 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Материалы не добавлены.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-slate-700">
                          {lesson.materials.map((material) => {
                            const requestKey = `${lesson.id}:${material.id}`;
                            const isDeleting =
                              deletingMaterialKey === requestKey;
                            return (
                              <li
                                key={requestKey}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                              >
                                {material.url ? (
                                  <a
                                    href={material.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="min-w-0 truncate text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                                    title="Открыть материал"
                                  >
                                    {material.title}
                                  </a>
                                ) : (
                                  <span
                                    className="min-w-0 truncate"
                                    title={material.title}
                                  >
                                    {material.title}
                                  </span>
                                )}
                                {material.canDelete ? (
                                  <button
                                    type="button"
                                    disabled={isDeleting}
                                    onClick={() =>
                                      void onDeleteLessonMaterial(
                                        lesson.id,
                                        material.id,
                                      )
                                    }
                                    className="shrink-0 whitespace-nowrap rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                  >
                                    {isDeleting ? "Удаление..." : "Удалить"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-400">
                                    без ID
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={savingLessonId === lesson.id}
                        onClick={() => void onSaveLesson(lesson)}
                        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                      >
                        {savingLessonId === lesson.id
                          ? "Сохранение..."
                          : "Сохранить урок"}
                      </button>
                      <button
                        type="button"
                        disabled={deletingLessonId === lesson.id}
                        onClick={() => void onDeleteLesson(lesson.id)}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      >
                        {deletingLessonId === lesson.id
                          ? "Удаление..."
                          : "Удалить урок"}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
