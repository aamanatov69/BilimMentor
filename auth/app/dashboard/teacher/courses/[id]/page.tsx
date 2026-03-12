"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseDetails = {
  course: {
    id: string;
    title: string;
    description: string;
    modules?: Array<Record<string, unknown>>;
  };
  students: {
    id: string;
    fullName: string;
    email: string;
  }[];
  materials: {
    id: string;
    title: string;
    type: string;
    uploadedAt: string;
    url: string | null;
  }[];
  assignments: {
    id: string;
    title: string;
    dueAt: string | null;
    submissions: number;
  }[];
  submissions: {
    id: string;
    studentName: string;
    assignmentTitle: string;
    status: string;
  }[];
};

type LessonItem = {
  id: string;
  title: string;
  description: string;
  isVisibleToStudents: boolean;
  materials: Array<Record<string, unknown>>;
};

type LessonUploadFile = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

const MAX_LESSON_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function toDataUrl(file: unknown) {
  const record = toRecord(file);
  if (!record) return "";
  const mime = typeof record.type === "string" ? record.type : "";
  const base64 =
    typeof record.dataBase64 === "string" ? record.dataBase64.trim() : "";
  if (!mime || !base64) return "";
  return `data:${mime};base64,${base64}`;
}

function toFileName(file: unknown) {
  const record = toRecord(file);
  if (!record) return "";
  return typeof record.name === "string" ? record.name : "";
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

export default function TeacherCourseDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const [details, setDetails] = useState<CourseDetails | null>(null);
  const [error, setError] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonLecture, setLessonLecture] = useState("");
  const [lessonLinks, setLessonLinks] = useState<string[]>([]);
  const [lessonFiles, setLessonFiles] = useState<File[]>([]);
  const [assignmentText, setAssignmentText] = useState("");
  const [assignmentDueAt, setAssignmentDueAt] = useState("");
  const [showLinkInputs, setShowLinkInputs] = useState(false);
  const [showFileInput, setShowFileInput] = useState(false);
  const [showAssignmentInput, setShowAssignmentInput] = useState(false);
  const [isCreateLessonOpen, setIsCreateLessonOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState("");
  const [editLessonTitle, setEditLessonTitle] = useState("");
  const [editLessonDescription, setEditLessonDescription] = useState("");
  const [editLessonLinks, setEditLessonLinks] = useState<string[]>([]);
  const [editLessonFiles, setEditLessonFiles] = useState<File[]>([]);
  const [editAssignmentText, setEditAssignmentText] = useState("");
  const [editAssignmentDueAt, setEditAssignmentDueAt] = useState("");
  const [showEditLinkInputs, setShowEditLinkInputs] = useState(false);
  const [showEditFileInput, setShowEditFileInput] = useState(false);
  const [showEditAssignmentInput, setShowEditAssignmentInput] = useState(false);
  const [deleteCourseModalOpen, setDeleteCourseModalOpen] = useState(false);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [deleteLessonId, setDeleteLessonId] = useState("");
  const [deleteLessonTitle, setDeleteLessonTitle] = useState("");
  const [busyLessonId, setBusyLessonId] = useState("");
  const [creatingLesson, setCreatingLesson] = useState(false);
  const [savingLessonEdit, setSavingLessonEdit] = useState(false);
  const lessonCameraInputRef = useRef<HTMLInputElement | null>(null);
  const editLessonCameraInputRef = useRef<HTMLInputElement | null>(null);

  const mapLessons = (modules: Array<Record<string, unknown>> | undefined) => {
    const list = Array.isArray(modules) ? modules : [];
    return list
      .filter(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          String(item.type ?? "").toLowerCase() === "lesson",
      )
      .map((item) => {
        const record = item as Record<string, unknown>;
        return {
          id: String(record.id ?? ""),
          title: String(record.title ?? "Без названия"),
          description: String(record.description ?? ""),
          isVisibleToStudents: Boolean(record.isVisibleToStudents ?? true),
          materials: Array.isArray(record.materials)
            ? (record.materials as Array<Record<string, unknown>>)
            : [],
        } satisfies LessonItem;
      })
      .filter((item) => item.id);
  };

  const lessons = mapLessons(details?.course.modules);

  const loadDetails = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/details`,
        {
          credentials: "include",
        },
      );
      const data = (await response.json()) as CourseDetails & {
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось загрузить данные курса");
        return;
      }

      setDetails(data);
    } catch {
      setError("Ошибка сети");
    }
  };

  useEffect(() => {
    if (id) {
      void loadDetails();
    }
  }, [id]);

  const resetCreateLessonDraft = () => {
    setLessonTitle("");
    setLessonLecture("");
    setLessonLinks([]);
    setLessonFiles([]);
    setAssignmentText("");
    setAssignmentDueAt("");
    setShowLinkInputs(false);
    setShowFileInput(false);
    setShowAssignmentInput(false);
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

  const updateEditLessonLink = (index: number, value: string) => {
    setEditLessonLinks((prev) =>
      prev.map((item, i) => (i === index ? value : item)),
    );
  };

  const removeEditLessonLink = (index: number) => {
    setEditLessonLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditLessonFile = (targetIndex: number) => {
    setEditLessonFiles((prev) =>
      prev.filter((_, index) => index !== targetIndex),
    );
  };

  const handleEditLessonFilesChange = (files: FileList | null) => {
    const picked = files ? Array.from(files) : [];
    const oversized = picked.find(
      (file) => file.size > MAX_LESSON_FILE_SIZE_BYTES,
    );
    if (oversized) {
      setError(`Файл ${oversized.name} превышает лимит 20 МБ`);
      return;
    }
    setError("");
    setEditLessonFiles((prev) => [...prev, ...picked]);
  };

  const addMaterialToLesson = async (
    lessonId: string,
    payload: Record<string, unknown>,
  ) => {
    const response = await fetch(
      `${API_URL}/api/teacher/courses/${id}/lessons/${lessonId}/materials`,
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

  const createLesson = async () => {
    const normalizedTitle = lessonTitle.trim();
    const normalizedLecture = lessonLecture.trim();
    if (!normalizedTitle) {
      setError("Введите название урока");
      return;
    }

    setCreatingLesson(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/lessons`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: normalizedTitle,
            description: normalizedLecture,
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        lesson?: { id?: string };
      };
      if (!response.ok) {
        setError(data.message ?? "Не удалось создать урок");
        return;
      }

      const lessonId = String(data.lesson?.id ?? "");
      if (!lessonId) {
        setError("Урок создан, но не получен его идентификатор");
        return;
      }

      if (normalizedLecture) {
        await addMaterialToLesson(lessonId, {
          type: "lecture",
          title: `Лекция: ${normalizedTitle}`,
          text: normalizedLecture,
        });
      }

      const links = lessonLinks
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, link] of links.entries()) {
        await addMaterialToLesson(lessonId, {
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

        await addMaterialToLesson(lessonId, {
          type: detectMaterialTypeFromMime(payloadFile.type),
          title: file.name,
          file: payloadFile,
        });
      }

      if (showAssignmentInput && assignmentText.trim()) {
        const assignmentResponse = await fetch(
          `${API_URL}/api/teacher/courses/${id}/assignments`,
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
              dueAt: assignmentDueAt || undefined,
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

      resetCreateLessonDraft();
      setIsCreateLessonOpen(false);
      await loadDetails();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Ошибка сети при сохранении урока",
      );
    } finally {
      setCreatingLesson(false);
    }
  };

  const toggleLessonVisibility = async (
    lessonId: string,
    isVisibleToStudents: boolean,
  ) => {
    setBusyLessonId(lessonId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/lessons/${lessonId}/visibility`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isVisibleToStudents: !isVisibleToStudents }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось изменить видимость урока");
        return;
      }

      await loadDetails();
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusyLessonId("");
    }
  };

  const openEditLesson = (lesson: LessonItem) => {
    if (editingLessonId === lesson.id) {
      closeEditLesson();
      return;
    }
    setError("");
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title);
    setEditLessonDescription(lesson.description ?? "");
    setEditLessonLinks([]);
    setEditLessonFiles([]);
    setEditAssignmentText("");
    setEditAssignmentDueAt("");
    setShowEditLinkInputs(false);
    setShowEditFileInput(false);
    setShowEditAssignmentInput(false);
  };

  const closeEditLesson = () => {
    setEditingLessonId("");
    setEditLessonTitle("");
    setEditLessonDescription("");
    setEditLessonLinks([]);
    setEditLessonFiles([]);
    setEditAssignmentText("");
    setEditAssignmentDueAt("");
    setShowEditLinkInputs(false);
    setShowEditFileInput(false);
    setShowEditAssignmentInput(false);
  };

  const saveLessonEdit = async () => {
    if (!editingLessonId) {
      setError("Выберите урок для редактирования");
      return;
    }
    if (!editLessonTitle.trim()) {
      setError("Введите название урока");
      return;
    }

    setSavingLessonEdit(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/lessons/${editingLessonId}`,
        {
          credentials: "include",
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: editLessonTitle.trim(),
            description: editLessonDescription.trim(),
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось обновить урок");
        return;
      }

      const links = editLessonLinks
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      for (const [index, link] of links.entries()) {
        await addMaterialToLesson(editingLessonId, {
          type: "link",
          title: `Ссылка ${index + 1}`,
          url: link,
        });
      }

      for (const file of editLessonFiles) {
        const dataBase64 = await fileToBase64(file);
        const payloadFile: LessonUploadFile = {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataBase64,
        };

        await addMaterialToLesson(editingLessonId, {
          type: detectMaterialTypeFromMime(payloadFile.type),
          title: file.name,
          file: payloadFile,
        });
      }

      if (showEditAssignmentInput && editAssignmentText.trim()) {
        const assignmentResponse = await fetch(
          `${API_URL}/api/teacher/courses/${id}/assignments`,
          {
            credentials: "include",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: editAssignmentText.trim().slice(0, 120),
              description: editAssignmentText.trim(),
              lessonId: editingLessonId,
              dueAt: editAssignmentDueAt || undefined,
            }),
          },
        );

        const assignmentData = (await assignmentResponse.json()) as {
          message?: string;
        };

        if (!assignmentResponse.ok) {
          throw new Error(
            assignmentData.message ?? "Урок обновлен, но задание не сохранено",
          );
        }
      }

      closeEditLesson();
      await loadDetails();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Ошибка сети при сохранении урока",
      );
    } finally {
      setSavingLessonEdit(false);
    }
  };

  const deleteLesson = async (lessonId: string, lessonTitleValue: string) => {
    setBusyLessonId(lessonId);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/lessons/${lessonId}`,
        {
          credentials: "include",
          method: "DELETE",
          headers: {},
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить урок");
        return;
      }

      if (editingLessonId === lessonId) {
        closeEditLesson();
      }
      setDeleteLessonId("");
      setDeleteLessonTitle("");
      await loadDetails();
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusyLessonId("");
    }
  };

  const askDeleteLesson = (lessonId: string, lessonTitleValue: string) => {
    setError("");
    setDeleteLessonId(lessonId);
    setDeleteLessonTitle(lessonTitleValue);
  };

  const cancelDeleteLesson = () => {
    if (busyLessonId) {
      return;
    }
    setDeleteLessonId("");
    setDeleteLessonTitle("");
  };

  const deleteCurrentLesson = async () => {
    if (!deleteLessonId) {
      return;
    }
    await deleteLesson(deleteLessonId, deleteLessonTitle);
  };

  const deleteCourse = async () => {
    setIsDeletingCourse(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/teacher/courses/${id}`, {
        credentials: "include",
        method: "DELETE",
      });

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить курс");
        return;
      }

      setDeleteCourseModalOpen(false);
      window.location.assign("/dashboard/teacher/courses");
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsDeletingCourse(false);
    }
  };

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {details?.course.title ?? `Курс: ${id}`}
            </h1>
            <p className="mt-1 text-slate-600">
              {details?.course.description ??
                "Детальная страница курса преподавателя."}
            </p>
            {error ? (
              <p className="mt-2 text-sm text-rose-600">{error}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/teacher/courses"
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Все курсы
            </Link>
            <Link
              href={`/dashboard/teacher/courses/${id}/edit`}
              className="rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Редактировать курс
            </Link>
            <button
              type="button"
              onClick={() => {
                setError("");
                setDeleteCourseModalOpen(true);
              }}
              className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
            >
              Удалить курс
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Уроки курса</h2>
          <button
            type="button"
            className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800"
            onClick={() => {
              setError("");
              setIsCreateLessonOpen((prev) => !prev);
            }}
          >
            {isCreateLessonOpen ? "Скрыть окно" : "Добавить урок"}
          </button>
        </div>

        {isCreateLessonOpen ? (
          <div className="rounded border border-slate-200 p-3">
            <p className="text-sm font-medium">Создать урок</p>
            <input
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Название урока"
              value={lessonTitle}
              onChange={(event) => setLessonTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createLesson();
                }
              }}
            />
            <textarea
              className="mt-2 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="Лекция"
              value={lessonLecture}
              onChange={(event) => setLessonLecture(event.target.value)}
            />

            <div className="mt-2 flex flex-wrap gap-2">
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
              <div className="mt-2 space-y-2 rounded border border-slate-200 p-3">
                {lessonLinks.length === 0 ? (
                  <p className="text-xs text-slate-600">
                    Нажмите "Добавить ссылку", чтобы добавить строку.
                  </p>
                ) : (
                  lessonLinks.map((link, index) => (
                    <div key={`link-${index + 1}`} className="flex gap-2">
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
              <div className="mt-2 rounded border border-slate-200 p-3">
                <p className="text-xs text-slate-600">
                  Можно загружать фото, видео, PDF и другие типы файлов. На
                  телефоне можно сразу сделать фото и прикрепить.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-sky-300 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50"
                    onClick={() => lessonCameraInputRef.current?.click()}
                  >
                    Сфотографировать и прикрепить
                  </button>
                </div>
                <input
                  ref={lessonCameraInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    handleLessonFilesChange(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
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
              <div className="mt-2 space-y-2">
                <textarea
                  className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Поле задания"
                  value={assignmentText}
                  onChange={(event) => setAssignmentText(event.target.value)}
                />
                <div>
                  <label className="text-xs text-slate-600">Дедлайн</label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={assignmentDueAt}
                    onChange={(event) => setAssignmentDueAt(event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void createLesson()}
                disabled={creatingLesson || !lessonTitle.trim()}
                className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {creatingLesson ? "Сохранение..." : "Сохранить урок"}
              </button>
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                onClick={() => {
                  resetCreateLessonDraft();
                  setError("");
                  setIsCreateLessonOpen(false);
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {lessons.length === 0 ? (
            <p className="text-sm text-slate-600">Уроков пока нет.</p>
          ) : (
            lessons.map((lesson, index) => (
              <article
                key={lesson.id}
                className="rounded border border-slate-200 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Урок {index + 1}
                    </p>
                    <p className="font-medium">{lesson.title}</p>
                    {editingLessonId === lesson.id ? (
                      <>
                        <p className="text-sm text-slate-600">
                          {lesson.description || "Без описания"}
                        </p>
                        <p
                          className={
                            lesson.isVisibleToStudents
                              ? "text-xs text-emerald-700"
                              : "text-xs text-amber-700"
                          }
                        >
                          {lesson.isVisibleToStudents
                            ? "Показан студентам"
                            : "Скрыт от студентов"}
                        </p>
                      </>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditLesson(lesson)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      {editingLessonId === lesson.id
                        ? "Скрыть редактор"
                        : "Редактировать урок"}
                    </button>
                    <button
                      type="button"
                      onClick={() => askDeleteLesson(lesson.id, lesson.title)}
                      disabled={busyLessonId === lesson.id}
                      className="rounded border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      Удалить урок
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleLessonVisibility(
                          lesson.id,
                          lesson.isVisibleToStudents,
                        )
                      }
                      disabled={busyLessonId === lesson.id}
                      className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {lesson.isVisibleToStudents
                        ? "Скрыть урок"
                        : "Показать урок"}
                    </button>
                  </div>
                </div>

                {editingLessonId === lesson.id ? (
                  <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm font-semibold">
                      Редактирование урока
                    </p>
                    <input
                      className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Название урока"
                      value={editLessonTitle}
                      onChange={(event) =>
                        setEditLessonTitle(event.target.value)
                      }
                    />
                    <textarea
                      className="mt-2 min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Лекция"
                      value={editLessonDescription}
                      onChange={(event) =>
                        setEditLessonDescription(event.target.value)
                      }
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditLinkInputs(true);
                          setEditLessonLinks((prev) => [...prev, ""]);
                        }}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Добавить ссылку
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditFileInput((prev) => !prev)}
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Добавить файлы
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowEditAssignmentInput((prev) => !prev)
                        }
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        Добавить задание
                      </button>
                    </div>

                    {showEditLinkInputs ? (
                      <div className="mt-2 space-y-2 rounded border border-slate-200 p-3">
                        {editLessonLinks.length === 0 ? (
                          <p className="text-xs text-slate-600">
                            Нажмите "Добавить ссылку", чтобы добавить строку.
                          </p>
                        ) : (
                          editLessonLinks.map((link, index) => (
                            <div
                              key={`edit-link-${index + 1}`}
                              className="flex gap-2"
                            >
                              <input
                                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                                placeholder={`Ссылка ${index + 1}`}
                                value={link}
                                onChange={(event) =>
                                  updateEditLessonLink(
                                    index,
                                    event.target.value,
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
                                onClick={() => removeEditLessonLink(index)}
                              >
                                Убрать
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}

                    {showEditFileInput ? (
                      <div className="mt-2 rounded border border-slate-200 p-3">
                        <p className="text-xs text-slate-600">
                          Можно загружать несколько файлов за раз. На телефоне
                          можно сразу сделать фото и прикрепить.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded border border-sky-300 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50"
                            onClick={() =>
                              editLessonCameraInputRef.current?.click()
                            }
                          >
                            Сфотографировать и прикрепить
                          </button>
                        </div>
                        <input
                          ref={editLessonCameraInputRef}
                          type="file"
                          className="sr-only"
                          accept="image/*"
                          capture="environment"
                          onChange={(event) => {
                            handleEditLessonFilesChange(event.target.files);
                            event.currentTarget.value = "";
                          }}
                        />
                        <input
                          type="file"
                          className="mt-2 w-full text-sm"
                          multiple
                          onChange={(event) =>
                            handleEditLessonFilesChange(event.target.files)
                          }
                        />
                        {editLessonFiles.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-sm">
                            {editLessonFiles.map((file, index) => (
                              <li
                                key={`${file.name}-${file.size}-${index}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <span>{file.name}</span>
                                <button
                                  type="button"
                                  className="text-rose-600 hover:underline"
                                  onClick={() => removeEditLessonFile(index)}
                                >
                                  Убрать
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}

                    {showEditAssignmentInput ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          className="min-h-20 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Поле задания"
                          value={editAssignmentText}
                          onChange={(event) =>
                            setEditAssignmentText(event.target.value)
                          }
                        />
                        <div>
                          <label className="text-xs text-slate-600">
                            Дедлайн
                          </label>
                          <input
                            type="datetime-local"
                            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                            value={editAssignmentDueAt}
                            onChange={(event) =>
                              setEditAssignmentDueAt(event.target.value)
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveLessonEdit()}
                        disabled={savingLessonEdit || !editLessonTitle.trim()}
                        className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
                      >
                        {savingLessonEdit ? "Сохранение..." : "Сохранить"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                        onClick={closeEditLesson}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : null}

                {editingLessonId === lesson.id ? (
                  <div className="mt-3 space-y-2">
                    {lesson.materials.length === 0 ? (
                      <p className="text-xs text-slate-600">
                        Материалов пока нет.
                      </p>
                    ) : (
                      lesson.materials.map((material, materialIndex) => (
                        <article
                          key={`${lesson.id}-mat-${materialIndex + 1}`}
                          className="rounded border border-slate-200 p-2"
                        >
                          {(() => {
                            const materialUrl =
                              String(material.url ?? "") ||
                              toDataUrl(material.file);
                            const fileName = toFileName(material.file);

                            return (
                              <>
                                <p className="text-sm font-medium">
                                  {String(
                                    material.title ??
                                      `Материал ${materialIndex + 1}`,
                                  )}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {String(material.type ?? "material")}
                                </p>
                                {fileName ? (
                                  <p className="mt-1 text-xs text-slate-600">
                                    Файл: {fileName}
                                  </p>
                                ) : null}
                                {materialUrl ? (
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                                    <a
                                      href={materialUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-blue-700 hover:underline"
                                    >
                                      Открыть
                                    </a>
                                    <a
                                      href={materialUrl}
                                      download={fileName || undefined}
                                      className="text-blue-700 hover:underline"
                                    >
                                      Скачать
                                    </a>
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
                        </article>
                      ))
                    )}
                  </div>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <ConfirmModal
        isOpen={deleteCourseModalOpen}
        title="Удалить курс?"
        description="Курс и связанные материалы будут удалены без возможности восстановления."
        confirmText="Подтвердить"
        cancelText="Отмена"
        isBusy={isDeletingCourse}
        onCancel={() => {
          if (isDeletingCourse) {
            return;
          }
          setDeleteCourseModalOpen(false);
        }}
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
        onCancel={cancelDeleteLesson}
        onConfirm={() => void deleteCurrentLesson()}
      />
    </main>
  );
}
