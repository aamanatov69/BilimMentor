"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseModule = Record<string, unknown>;

type StudentProgress = {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  completedLessonIds: string[];
};

type CourseItem = {
  id: string;
  title: string;
  category: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  progress?: number;
  studentProgress?: StudentProgress;
  modules?: CourseModule[];
};

type CourseMaterialItem = {
  id: string;
  type: string;
  kindLabel: string;
  title: string;
  text: string;
  url: string;
  fileName: string;
};

type CourseLessonItem = {
  id: string;
  title: string;
  text: string;
  materials: CourseMaterialItem[];
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function resolveMaterialUrl(material: Record<string, unknown>) {
  const directUrl = asString(material.url);
  if (directUrl) return directUrl;

  const file = toRecord(material.file);
  if (!file) return "";

  const mimeType = asString(file.type);
  const dataBase64 = asString(file.dataBase64);
  if (!mimeType || !dataBase64) return "";

  return `data:${mimeType};base64,${dataBase64}`;
}

function resolveMaterialFileName(material: Record<string, unknown>) {
  const file = toRecord(material.file);
  if (!file) return "";
  return asString(file.name);
}

function moduleKindLabel(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("video")) return "Видео";
  if (normalized.includes("book")) return "Книга";
  if (normalized.includes("lecture") || normalized.includes("text")) {
    return "Текст лекции";
  }
  if (normalized.includes("presentation") || normalized.includes("slide")) {
    return "Презентация";
  }
  if (normalized.includes("formula") || normalized.includes("math")) {
    return "Формула";
  }
  if (normalized.includes("code")) return "Код";
  if (normalized.includes("material")) return "Материал";
  if (normalized.includes("lesson") || normalized.includes("module")) {
    return "Урок";
  }
  return "Материал";
}

function extractCourseContent(modules: CourseModule[] | undefined) {
  const source = Array.isArray(modules) ? modules : [];

  const lessonModules: CourseLessonItem[] = source
    .map((module, index) => {
      const record = toRecord(module);
      if (!record) return null;

      const type = asString(record.type).toLowerCase();
      if (type !== "lesson") return null;

      const isVisibleToStudents =
        typeof record.isVisibleToStudents === "boolean"
          ? record.isVisibleToStudents
          : true;
      if (!isVisibleToStudents) return null;

      const lessonTitle =
        asString(record.title) || asString(record.name) || `Урок ${index + 1}`;
      const lessonId = asString(record.id).trim() || `lesson-${index + 1}`;
      const lessonText = asString(record.description);

      const materials: CourseMaterialItem[] = Array.isArray(record.materials)
        ? record.materials
            .map((mat, matIndex) => {
              const material = toRecord(mat);
              if (!material) return null;
              const matType = asString(material.type) || "material";
              const matTitle =
                asString(material.title) || `Материал ${matIndex + 1}`;
              const matText =
                asString(material.text) ||
                asString(material.table) ||
                asString(material.formula) ||
                asString(material.code);
              const matUrl = resolveMaterialUrl(material);
              const matFileName = resolveMaterialFileName(material);

              return {
                id: `${lessonTitle}-material-${matIndex + 1}`,
                type: matType,
                kindLabel: moduleKindLabel(matType),
                title: matTitle,
                text: matText,
                url: matUrl,
                fileName: matFileName,
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
        : [];

      return {
        id: lessonId,
        title: lessonTitle,
        text: lessonText,
        materials,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    lessons: lessonModules,
  };
}

export default function StudentCourseDetailsPage() {
  const params = useParams();
  const courseId = String(params.id ?? "");

  const [course, setCourse] = useState<CourseItem | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [busyMaterialId, setBusyMaterialId] = useState("");
  const [busyLessonId, setBusyLessonId] = useState("");

  const loadCourse = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/courses/${courseId}?_ts=${Date.now()}`,
        {
          credentials: "include",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          cache: "no-store",
        },
      );

      const data = (await response.json()) as {
        course?: CourseItem;
        message?: string;
      };

      if (!response.ok || !data.course) {
        setError(data.message ?? "Не удалось загрузить курс");
        setCourse(null);
        return;
      }

      setCourse(data.course);
      setSelectedLessonId("");
    } catch {
      setError("Ошибка сети при загрузке курса");
      setCourse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      void loadCourse();
    }
  }, [courseId]);

  const openMaterial = async (item: CourseMaterialItem) => {
    if (!item.url) {
      return;
    }

    setBusyMaterialId(item.id);
    try {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } catch {
      setError("Не удалось открыть материал");
    } finally {
      setBusyMaterialId("");
    }
  };

  const downloadMaterial = async (item: CourseMaterialItem) => {
    if (!item.url) {
      return;
    }

    setBusyMaterialId(item.id);
    try {
      if (item.url.startsWith("data:")) {
        const response = await fetch(item.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = item.fileName || item.title || "material";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      } else {
        const anchor = document.createElement("a");
        anchor.href = item.url;
        anchor.download = item.fileName || "";
        anchor.target = "_blank";
        anchor.rel = "noreferrer";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    } catch {
      setError("Не удалось скачать материал");
    } finally {
      setBusyMaterialId("");
    }
  };

  const setLessonCompletion = async (lessonId: string, completed: boolean) => {
    setBusyLessonId(lessonId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/student/courses/${courseId}/lessons/${lessonId}/completion`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ completed }),
        },
      );

      const data = (await response.json()) as {
        studentProgress?: StudentProgress;
        message?: string;
      };

      if (!response.ok || !data.studentProgress) {
        setError(data.message ?? "Не удалось обновить прогресс урока");
        return;
      }

      const studentProgress = data.studentProgress;

      setCourse((previous) =>
        previous
          ? {
              ...previous,
              progress: studentProgress.progressPercent,
              studentProgress,
            }
          : previous,
      );
    } catch {
      setError("Ошибка сети при обновлении прогресса");
    } finally {
      setBusyLessonId("");
    }
  };

  const content = extractCourseContent(course?.modules);
  const completedLessonIds = new Set(
    course?.studentProgress?.completedLessonIds ?? [],
  );
  const totalLessons =
    course?.studentProgress?.totalLessons ?? content.lessons.length;
  const completedLessons =
    course?.studentProgress?.completedLessons ??
    [...completedLessonIds].filter((lessonId) =>
      content.lessons.some((lesson) => lesson.id === lessonId),
    ).length;
  const progressPercent =
    course?.studentProgress?.progressPercent ??
    (totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0);
  return (
    <>
      <main className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="break-words text-xl font-semibold sm:text-2xl">
              {course?.title ?? "Просмотр курса"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {course?.description ?? "Материалы и уроки курса"}
            </p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => void loadCourse()}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 sm:w-auto"
            >
              Обновить
            </button>
            <Link
              href="/dashboard/student/courses"
              className="w-full rounded border border-slate-300 px-3 py-2 text-center text-sm hover:bg-slate-50 sm:w-auto"
            >
              Назад к курсам
            </Link>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-600">Загрузка...</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {!loading && !error ? (
          <div className="space-y-5">
            <section className="rounded border border-slate-200 bg-slate-50 p-3">
              <h2 className="text-lg font-semibold">Прогресс по курсу</h2>
              <p className="mt-1 text-sm text-slate-700">
                Завершено уроков: {completedLessons} из {totalLessons}
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-700">
                Текущий прогресс: {progressPercent}%
              </p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, progressPercent))}%`,
                  }}
                />
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">Уроки курса</h2>
              {content.lessons.length === 0 ? (
                <p className="mt-2 text-sm text-slate-600">
                  Уроки пока не добавлены.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {content.lessons.map((item, lessonIndex) => (
                    <article
                      key={item.id}
                      className={
                        selectedLessonId === item.id
                          ? "rounded border border-blue-300 bg-blue-50 p-3"
                          : "rounded border border-slate-200 p-3"
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedLessonId((previous) =>
                            previous === item.id ? "" : item.id,
                          )
                        }
                        className="w-full text-left"
                      >
                        <p className="text-xs font-semibold text-slate-500">
                          Урок {lessonIndex + 1}
                        </p>
                        <p className="break-words font-medium">{item.title}</p>
                      </button>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {completedLessonIds.has(item.id) ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Урок пройден
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            Урок не завершен
                          </span>
                        )}

                        <button
                          type="button"
                          disabled={busyLessonId === item.id}
                          onClick={() =>
                            void setLessonCompletion(
                              item.id,
                              !completedLessonIds.has(item.id),
                            )
                          }
                          className="rounded border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          {busyLessonId === item.id
                            ? "Сохранение..."
                            : completedLessonIds.has(item.id)
                              ? "Снять отметку"
                              : "Урок пройден"}
                        </button>
                      </div>

                      {selectedLessonId === item.id ? (
                        <div className="mt-4 border-t border-blue-200 pt-4">
                          {item.materials.length === 0 ? (
                            <p className="mt-2 text-sm text-slate-600">
                              Для этого урока пока нет материалов.
                            </p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {item.materials.map((material) => (
                                <article
                                  key={material.id}
                                  className="rounded border border-slate-200 bg-white p-3"
                                >
                                  <p className="break-words font-medium">
                                    {material.title}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {material.kindLabel}
                                  </p>
                                  {material.text ? (
                                    <p className="mt-1 break-words text-sm text-slate-700">
                                      {material.text}
                                    </p>
                                  ) : null}
                                  {material.url ? (
                                    <div className="mt-2 grid gap-2 text-sm sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                                      <button
                                        type="button"
                                        disabled={
                                          busyMaterialId === material.id
                                        }
                                        onClick={() =>
                                          void openMaterial(material)
                                        }
                                        className="rounded border border-blue-200 px-3 py-1.5 text-left text-blue-700 hover:bg-blue-50"
                                      >
                                        {busyMaterialId === material.id
                                          ? "Загрузка..."
                                          : "Открыть материал"}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          busyMaterialId === material.id
                                        }
                                        onClick={() =>
                                          void downloadMaterial(material)
                                        }
                                        className="rounded border border-blue-200 px-3 py-1.5 text-left text-blue-700 hover:bg-blue-50"
                                      >
                                        Скачать
                                      </button>
                                    </div>
                                  ) : null}
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </>
  );
}
