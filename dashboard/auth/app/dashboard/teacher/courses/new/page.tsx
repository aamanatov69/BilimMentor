"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const MAX_LESSON_FILE_SIZE_BYTES = 20 * 1024 * 1024;

type Step = 1 | 2;

type LessonUploadFile = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
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

  const [step, setStep] = useState<Step>(1);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonLecture, setLessonLecture] = useState("");
  const [lessonLinks, setLessonLinks] = useState<string[]>([]);
  const [lessonFiles, setLessonFiles] = useState<File[]>([]);
  const [assignmentText, setAssignmentText] = useState("");
  const [showLinkInputs, setShowLinkInputs] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const [showAssignmentInput, setShowAssignmentInput] = useState(false);

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const goNext = () => {
    if (!courseTitle.trim()) {
      setError("Введите название курса");
      return;
    }
    if (!courseDescription.trim()) {
      setError("Введите описание курса");
      return;
    }
    setError("");
    setStep(2);
  };

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
    token: string,
    courseId: string,
    lessonId: string,
    payload: Record<string, unknown>,
  ) => {
    const response = await fetch(
      `${API_URL}/api/teacher/courses/${courseId}/lessons/${lessonId}/materials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: courseTitle.trim(),
            description: courseDescription.trim(),
            level: "beginner",
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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
        await addMaterialToLesson(token, courseId, lessonId, {
          type: "lecture",
          title: `Лекция: ${lessonTitle.trim()}`,
          text: lessonLecture.trim(),
        });
      }

      const links = lessonLinks
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, link] of links.entries()) {
        await addMaterialToLesson(token, courseId, lessonId, {
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

        await addMaterialToLesson(token, courseId, lessonId, {
          type: detectMaterialTypeFromMime(payloadFile.type),
          title: file.name,
          file: payloadFile,
        });
      }

      if (showAssignmentInput && assignmentText.trim()) {
        const assignmentResponse = await fetch(
          `${API_URL}/api/teacher/courses/${courseId}/assignments`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: assignmentText.trim().slice(0, 120),
              description: assignmentText.trim(),
              lessonId,
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
    <main className="max-w-3xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Добавление курса</h1>
        <Link
          href="/dashboard/teacher/courses"
          className="text-sm text-blue-700 hover:underline"
        >
          К списку курсов
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div
          className={
            step === 1
              ? "rounded border border-blue-300 bg-blue-50 p-3"
              : "rounded border border-slate-200 bg-slate-50 p-3"
          }
        >
          <p className="text-sm font-semibold">Шаг 1</p>
          <p className="text-sm text-slate-600">Название и описание курса</p>
        </div>
        <div
          className={
            step === 2
              ? "rounded border border-blue-300 bg-blue-50 p-3"
              : "rounded border border-slate-200 bg-slate-50 p-3"
          }
        >
          <p className="text-sm font-semibold">Шаг 2</p>
          <p className="text-sm text-slate-600">Создание первого урока</p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {step === 1 ? (
        <section className="mt-4 space-y-3 rounded border border-slate-200 p-4">
          <h2 className="text-lg font-semibold">Данные курса</h2>
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Название курса"
            value={courseTitle}
            onChange={(event) => setCourseTitle(event.target.value)}
          />
          <textarea
            className="min-h-32 w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Описание курса"
            value={courseDescription}
            onChange={(event) => setCourseDescription(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={goNext}
              className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
            >
              Далее
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <form
          onSubmit={onSubmit}
          className="mt-4 space-y-4 rounded border border-slate-200 p-4"
        >
          <h2 className="text-lg font-semibold">Добавление урока</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Название урока
            </label>
            <input
              className="w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Например: Введение в Python"
              value={lessonTitle}
              onChange={(event) => setLessonTitle(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Лекция</label>
            <textarea
              className="min-h-24 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Текст лекции"
              value={lessonLecture}
              onChange={(event) => setLessonLecture(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowLinkInputs(true);
                setLessonLinks((prev) => [...prev, ""]);
              }}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Добавить ссылку
            </button>
            <button
              type="button"
              onClick={() => setShowFileInput((prev) => !prev)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Добавить файлы
            </button>
            <button
              type="button"
              onClick={() => setShowAssignmentInput((prev) => !prev)}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Добавить задание
            </button>
          </div>

          {showLinkInputs ? (
            <div className="space-y-2 rounded border border-slate-200 p-3">
              {lessonLinks.length === 0 ? (
                <p className="text-xs text-slate-600">
                  Нажмите "Добавить ссылку", чтобы добавить строку.
                </p>
              ) : (
                lessonLinks.map((link, index) => (
                  <div key={`new-link-${index + 1}`} className="flex gap-2">
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder={`Ссылка ${index + 1}`}
                      value={link}
                      onChange={(event) =>
                        updateLessonLink(index, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
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
            <div className="rounded border border-slate-200 p-3">
              <p className="text-xs text-slate-600">
                Можно загружать фото, видео, PDF и другие типы файлов.
              </p>
              <input
                type="file"
                className="mt-2 w-full text-sm"
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
                        className="text-rose-600 hover:underline"
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

          {showAssignmentInput ? (
            <textarea
              className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Поле задания"
              value={assignmentText}
              onChange={(event) => setAssignmentText(event.target.value)}
            />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
              onClick={() => {
                setError("");
                setStep(1);
              }}
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      ) : null}
    </main>
  );
}
