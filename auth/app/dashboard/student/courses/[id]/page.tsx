"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { renderTextWithMathTypeTokensHtml } from "@/lib/math-render";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseModule = Record<string, unknown>;

type StudentProgress = {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  completedLessonIds: string[];
};

type CourseData = {
  id: string;
  title: string;
  description: string;
  isPublished?: boolean;
  progress?: number;
  modules?: CourseModule[];
  studentProgress?: StudentProgress;
};

type LessonMaterial = {
  id: string;
  title: string;
  type: string;
  text: string;
  url: string;
  fileName: string;
};

type LessonItem = {
  id: string;
  title: string;
  description: string;
  materials: LessonMaterial[];
};

type AssignmentItem = {
  id: string;
  title: string;
  dueAt: string | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
  course?: { id?: string; title?: string };
  submission: unknown;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeLessonText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractLessons(modules?: CourseModule[]) {
  const list = Array.isArray(modules) ? modules : [];

  return list
    .filter(
      (module) =>
        asString(module.type).toLowerCase() === "lesson" &&
        module.isVisibleToStudents !== false,
    )
    .map((module, index) => {
      const lesson = toRecord(module) ?? {};
      const materialsRaw = Array.isArray(lesson.materials)
        ? lesson.materials
        : [];
      const materials = materialsRaw
        .map((item, materialIndex) => {
          const material = toRecord(item);
          if (!material) return null;
          return {
            id: asString(material.id) || `material-${index}-${materialIndex}`,
            title: asString(material.title) || `Материал ${materialIndex + 1}`,
            type: asString(material.type) || "material",
            text:
              asString(material.text) ||
              asString(material.formula) ||
              asString(material.code) ||
              asString(material.table) ||
              "",
            url: asString(material.url) || "",
            fileName: asString(toRecord(material.file)?.name),
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return {
        id: asString(lesson.id) || `lesson-${index + 1}`,
        title: asString(lesson.title) || `Урок ${index + 1}`,
        description: asString(lesson.description),
        materials,
      };
    });
}

export default function StudentCourseDetailsPage() {
  const params = useParams();
  const courseId = String(params.id ?? "");

  const [course, setCourse] = useState<CourseData | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyLessonId, setBusyLessonId] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [courseResponse, assignmentsResponse] = await Promise.all([
        fetch(`${API_URL}/api/courses/${courseId}`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${API_URL}/api/student/assignments`, {
          credentials: "include",
        }),
      ]);

      const courseData = (await courseResponse.json()) as {
        course?: CourseData;
        message?: string;
      };
      const assignmentsData = (await assignmentsResponse.json()) as {
        assignments?: AssignmentItem[];
      };

      if (!courseResponse.ok || !courseData.course) {
        setError(courseData.message ?? "Не удалось загрузить курс");
        setCourse(null);
        return;
      }

      setCourse(courseData.course);
      const relatedAssignments = (assignmentsData.assignments ?? []).filter(
        (assignment) => assignment && assignment.lessonId !== undefined,
      );
      setAssignments(relatedAssignments);
    } catch {
      setError("Ошибка сети");
      setCourse(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!courseId) return;
    void loadData();
  }, [courseId]);

  const lessons = useMemo(
    () => extractLessons(course?.modules),
    [course?.modules],
  );

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const selectedLesson =
    lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  const courseCompletedByTeacher =
    Boolean(course) &&
    course?.isPublished === false &&
    (course?.progress ?? 0) >= 100;

  const shouldShowLessonDescription = useMemo(() => {
    if (!selectedLesson?.description) return false;

    const normalizedDescription = normalizeLessonText(
      selectedLesson.description,
    );
    if (!normalizedDescription) return false;

    const hasDuplicateMaterialText = selectedLesson.materials.some(
      (material) =>
        normalizeLessonText(material.text || "") === normalizedDescription,
    );

    return !hasDuplicateMaterialText;
  }, [selectedLesson]);

  const completedLessonIds = new Set(
    course?.studentProgress?.completedLessonIds ?? [],
  );

  const filteredAssignments = useMemo(() => {
    if (!courseId) return [];
    return assignments.filter(
      (item) =>
        asString(item.id) &&
        asString(item.course?.id) === courseId &&
        (!item.lessonId ||
          lessons.some((lesson) => lesson.id === item.lessonId)),
    );
  }, [assignments, courseId, lessons]);

  const setCompletion = async (lessonId: string, completed: boolean) => {
    setBusyLessonId(lessonId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/student/courses/${courseId}/lessons/${lessonId}/completion`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        },
      );

      const data = (await response.json()) as {
        studentProgress?: StudentProgress;
        message?: string;
      };

      if (!response.ok || !data.studentProgress) {
        setError(data.message ?? "Не удалось обновить прогресс");
        return;
      }

      setCourse((previous) =>
        previous
          ? {
              ...previous,
              studentProgress: data.studentProgress,
            }
          : previous,
      );
    } catch {
      setError("Ошибка сети при обновлении прогресса");
    } finally {
      setBusyLessonId("");
    }
  };

  return (
    <main className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {course?.title ?? "Курс"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {course?.description ?? "Материалы курса"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/student/courses"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Назад
            </Link>
            <button
              type="button"
              onClick={() => void loadData()}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Обновить
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">Общий прогресс</span>
            <span className="font-semibold text-slate-900">
              {course?.studentProgress?.progressPercent ?? 0}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
              style={{
                width: `${Math.max(0, Math.min(100, course?.studentProgress?.progressPercent ?? 0))}%`,
              }}
            />
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="h-[460px] animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-[460px] animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-[220px] animate-pulse rounded-3xl border border-slate-200 bg-white xl:col-span-2" />
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Уроки
            </h2>
            <div className="mt-3 space-y-2">
              {lessons.length ? (
                lessons.map((lesson, index) => {
                  const selected = lesson.id === selectedLessonId;
                  const done = completedLessonIds.has(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={
                        selected
                          ? "w-full rounded-2xl border border-sky-300 bg-sky-50 px-3 py-2 text-left"
                          : "w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                      }
                    >
                      <p className="text-xs text-slate-500">Урок {index + 1}</p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {lesson.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {done ? "✔ завершен" : "в процессе"}
                      </p>
                    </button>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Уроки пока не опубликованы.
                </p>
              )}
            </div>
          </aside>

          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {selectedLesson ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {selectedLesson.title}
                  </h2>
                  <button
                    type="button"
                    disabled={
                      busyLessonId === selectedLesson.id ||
                      courseCompletedByTeacher
                    }
                    onClick={() =>
                      void setCompletion(
                        selectedLesson.id,
                        !completedLessonIds.has(selectedLesson.id),
                      )
                    }
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                  >
                    {courseCompletedByTeacher
                      ? "Только просмотр"
                      : busyLessonId === selectedLesson.id
                        ? "Сохранение..."
                        : completedLessonIds.has(selectedLesson.id)
                          ? "Снять отметку"
                          : "Отметить завершенным"}
                  </button>
                </div>

                {courseCompletedByTeacher ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                    Курс завершен преподавателем. Можно только просматривать
                    уроки и материалы.
                  </p>
                ) : null}

                {shouldShowLessonDescription ? (
                  <div
                    className="mt-3 overflow-x-auto break-words text-base leading-relaxed text-slate-700"
                    dangerouslySetInnerHTML={{
                      __html: renderTextWithMathTypeTokensHtml(
                        selectedLesson.description,
                      ),
                    }}
                  />
                ) : null}

                <div className="mt-6 space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Контент урока
                  </h3>
                  {selectedLesson.materials.length ? (
                    selectedLesson.materials.map((material) => (
                      <div
                        key={material.id}
                        className="rounded-2xl border border-slate-200 p-4"
                      >
                        <p className="text-base font-semibold text-slate-900">
                          {material.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Тип: {material.type}
                        </p>
                        {material.text ? (
                          material.type.toLowerCase() === "lecture" ? (
                            <div
                              className="mt-3 overflow-x-auto break-words rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
                              dangerouslySetInnerHTML={{
                                __html: renderTextWithMathTypeTokensHtml(
                                  material.text,
                                ),
                              }}
                            />
                          ) : (
                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                              {material.text}
                            </pre>
                          )
                        ) : null}
                        {material.url ? (
                          <a
                            href={material.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Открыть материал
                          </a>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Материалы для этого урока пока не добавлены.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Выберите урок слева.
              </p>
            )}
          </article>

          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Задания и дедлайны
            </h2>
            <div className="mt-3 space-y-2">
              {filteredAssignments.length ? (
                filteredAssignments.map((assignment) => {
                  const dueAt = assignment.dueAt
                    ? new Date(assignment.dueAt)
                    : null;
                  const overdue = dueAt
                    ? dueAt.getTime() < Date.now() && !assignment.submission
                    : false;
                  return (
                    <article
                      key={assignment.id}
                      className="rounded-2xl border border-slate-200 p-3"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {assignment.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {assignment.lessonTitle || "Без привязки к уроку"}
                      </p>
                      <p
                        className={
                          overdue
                            ? "mt-2 text-xs font-semibold text-rose-700"
                            : "mt-2 text-xs text-slate-600"
                        }
                      >
                        {dueAt
                          ? `Срок: ${dueAt.toLocaleString("ru-RU")}`
                          : "Срок: не указан"}
                      </p>
                      <span
                        className={
                          assignment.submission
                            ? "mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                            : overdue
                              ? "mt-2 inline-flex rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700"
                              : "mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700"
                        }
                      >
                        {assignment.submission
                          ? "Сдано"
                          : overdue
                            ? "Просрочено"
                            : "Ожидает сдачи"}
                      </span>
                    </article>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Для курса пока нет заданий.
                </p>
              )}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
