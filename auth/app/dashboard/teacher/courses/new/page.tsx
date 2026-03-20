"use client";

import { CheckCircle2, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MAX_LESSON_FILE_SIZE_BYTES = 20 * 1024 * 1024;

type CourseLevel = "beginner" | "intermediate" | "advanced";

type LessonUploadFile = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

function getCourseLevelLabel(level: CourseLevel) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const payload = result.includes(",") ? result.split(",")[1] : result;
      resolve(payload);
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function detectMaterialTypeFromMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.includes("pdf")) return "pdf";
  return "file";
}

export default function NewTeacherCoursePage() {
  const router = useRouter();

  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseLevel, setCourseLevel] = useState<CourseLevel>("beginner");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonLecture, setLessonLecture] = useState("");
  const [lessonLinks, setLessonLinks] = useState<string[]>([]);
  const [lessonFiles, setLessonFiles] = useState<File[]>([]);
  const [assignmentText, setAssignmentText] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [showLinkInputs, setShowLinkInputs] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const [showAssignmentInput, setShowAssignmentInput] = useState(false);

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const updateLessonLink = (index: number, value: string) => {
    setLessonLinks((prev) =>
      prev.map((item, i) => (i === index ? value : item)),
    );
  };

  const removeLessonLink = (index: number) => {
    setLessonLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const removeLessonFile = (targetIndex: number) => {
    setLessonFiles((prev) => prev.filter((_, index) => index !== targetIndex));
  };

  const handleLessonFilesChange = (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    const oversized = picked.find(
      (file) => file.size > MAX_LESSON_FILE_SIZE_BYTES,
    );
    if (oversized) {
      setError(`Файл ${oversized.name} превышает лимит 20 МБ`);
      return;
    }
    setError("");
    setLessonFiles((prev) => [...prev, ...picked]);
  };

  const addMaterialToLesson = async (
    courseId: string,
    lessonId: string,
    payload: Record<string, unknown>,
  ) => {
    const response = await fetch(
      `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}/materials`,
      {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      throw new Error(data.message ?? "Не удалось добавить материал");
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!lessonTitle.trim()) {
      setError("Введите название урока");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const createCourseResponse = await fetch(
        `${API_URL}/api/teacher/courses`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: courseTitle.trim(),
            description: courseDescription.trim(),
            level: courseLevel,
            publishNow: false,
          }),
        },
      );

      const createCourseData = (await createCourseResponse.json()) as {
        message?: string;
        course?: { id?: string };
      };

      if (!createCourseResponse.ok) {
        setError(createCourseData.message ?? "Не удалось создать курс");
        return;
      }

      const courseId = String(createCourseData.course?.id ?? "");
      if (!courseId) {
        setError("Курс создан, но не получен его идентификатор");
        return;
      }

      const createLessonResponse = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/lessons`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: lessonTitle.trim(),
            description: lessonLecture.trim(),
          }),
        },
      );

      const createLessonData = (await createLessonResponse.json()) as {
        message?: string;
        lesson?: { id?: string };
      };

      if (!createLessonResponse.ok) {
        setError(createLessonData.message ?? "Курс создан, но урок не создан");
        return;
      }

      const lessonId = String(createLessonData.lesson?.id ?? "");
      if (!lessonId) {
        setError("Урок создан, но не получен его идентификатор");
        return;
      }

      if (lessonLecture.trim()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "lecture",
          title: `Лекция: ${lessonTitle.trim()}`,
          text: lessonLecture.trim(),
        });
      }

      const links = lessonLinks
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, link] of links.entries()) {
        await addMaterialToLesson(courseId, lessonId, {
          type: "link",
          title: `Ссылка ${index + 1}`,
          url: link,
        });
      }

      for (const file of lessonFiles) {
        const dataBase64 = await fileToBase64(file);
        const payloadFile: LessonUploadFile = {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataBase64,
        };

        await addMaterialToLesson(courseId, lessonId, {
          type: detectMaterialTypeFromMime(payloadFile.type),
          title: file.name,
          file: payloadFile,
        });
      }

      if (showAssignmentInput && assignmentText.trim()) {
        if (!assignmentDueAt.trim()) {
          throw new Error("Укажите дедлайн для задания");
        }

        const assignmentResponse = await fetch(
          `${API_URL}/api/teacher/courses/${courseId}/assignments`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: assignmentText.trim().slice(0, 120),
              description: assignmentText.trim(),
              lessonId,
              dueAt: assignmentDueAt,
            }),
          },
        );

        const assignmentData = (await assignmentResponse.json()) as {
          message?: string;
        };

        if (!assignmentResponse.ok) {
          throw new Error(
            assignmentData.message ?? "Урок создан, но задание не сохранено",
          );
        }
      }

      router.push("/dashboard/teacher/courses?created=1");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка сети при сохранении курса",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <main className="space-y-4 rounded-2xl bg-slate-50 p-3 text-slate-800 sm:p-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <h1 className="text-2xl font-semibold leading-tight">
            Настройки курса & Создание уроков
          </h1>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/teacher/courses"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Назад
            </Link>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Сохранение..." : "Сохранить изменения"}
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-3 text-2xl font-semibold">Управление уроками</h2>
            <div className="space-y-2">
              {lessonTitle.trim() ? (
                <article className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span className="text-lg font-medium">
                        1. {lessonTitle}
                      </span>
                    </span>
                  </div>
                </article>
              ) : (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Добавьте первый урок
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setLessonTitle("");
                setLessonLecture("");
                setLessonLinks([]);
                setLessonFiles([]);
                setAssignmentText("");
                setAssignmentDueAt("");
                setShowLinkInputs(false);
                setShowFileInput(false);
                setShowAssignmentInput(false);
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Добавить урок
            </button>
          </aside>

          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="grid overflow-hidden rounded-lg border border-slate-200 text-center text-lg font-semibold sm:grid-cols-2">
              <p className="bg-slate-100 px-3 py-2 text-slate-800">
                Информация о курсе
              </p>
              <p className="bg-blue-50 px-3 py-2 text-blue-700">
                Структура и уроки
              </p>
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <article className="rounded-lg border border-slate-200 bg-white p-3">
                <label className="text-sm text-slate-600">Название курса</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Название курса"
                  value={courseTitle}
                  onChange={(event) => setCourseTitle(event.target.value)}
                />

                <label className="mt-3 block text-sm text-slate-600">
                  Описание курса
                </label>
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Описание курса"
                  value={courseDescription}
                  onChange={(event) => setCourseDescription(event.target.value)}
                />

                <label className="mt-3 block text-sm text-slate-600">
                  Уровень курса
                </label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  value={courseLevel}
                  onChange={(event) =>
                    setCourseLevel(event.target.value as CourseLevel)
                  }
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

                <label className="mt-3 block text-sm text-slate-600">
                  Статус
                </label>
                <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
                  <option>Черновик</option>
                  <option>Активен</option>
                </select>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-3">
                <label className="text-sm text-slate-600">Название урока</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Название урока"
                  value={lessonTitle}
                  onChange={(event) => setLessonTitle(event.target.value)}
                />

                <label className="mt-3 block text-sm text-slate-600">
                  Описание урока
                </label>
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Лекция"
                  value={lessonLecture}
                  onChange={(event) => setLessonLecture(event.target.value)}
                />

                <label className="mt-3 block text-sm text-slate-600">
                  Материалы урока
                </label>
                <div className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowLinkInputs(true);
                        setLessonLinks((prev) => [...prev, ""]);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Добавить ссылку
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFileInput((prev) => !prev)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Добавить файлы
                    </button>
                  </div>

                  {showLinkInputs ? (
                    <div className="mt-2 space-y-2">
                      {lessonLinks.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          Нажмите "Добавить ссылку", чтобы добавить строку.
                        </p>
                      ) : (
                        lessonLinks.map((link, index) => (
                          <div
                            key={`new-link-${index + 1}`}
                            className="flex gap-2"
                          >
                            <input
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              placeholder={`Ссылка ${index + 1}`}
                              value={link}
                              onChange={(event) =>
                                updateLessonLink(index, event.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                              onClick={() => removeLessonLink(index)}
                            >
                              Убрать
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}

                  {showFileInput ? (
                    <div className="mt-2 rounded-lg border border-slate-300 bg-white p-3">
                      <p className="text-xs text-slate-500">
                        Можно загружать фото, видео, PDF и другие типы файлов.
                      </p>
                      <input
                        type="file"
                        className="mt-2 w-full text-sm text-slate-700"
                        multiple
                        onChange={(event) =>
                          handleLessonFilesChange(event.target.files)
                        }
                      />
                      {lessonFiles.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-sm">
                          {lessonFiles.map((file, index) => (
                            <li
                              key={`${file.name}-${file.size}-${index}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{file.name}</span>
                              <button
                                type="button"
                                className="text-rose-700 hover:underline"
                                onClick={() => removeLessonFile(index)}
                              >
                                Убрать
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignmentInput((prev) => !prev)}
                    className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    + Добавить задание
                  </button>
                </div>
              </article>
            </div>

            {showAssignmentInput ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <textarea
                  className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Поле задания"
                  value={assignmentText}
                  onChange={(event) => setAssignmentText(event.target.value)}
                />
                <div className="mt-2 space-y-1">
                  <label className="text-sm font-medium text-slate-600">
                    Дедлайн задания
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    value={assignmentDueAt}
                    onChange={(event) => setAssignmentDueAt(event.target.value)}
                    required={
                      showAssignmentInput && Boolean(assignmentText.trim())
                    }
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </form>
  );
}
