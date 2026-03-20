"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseLevel = "beginner" | "intermediate" | "advanced";

type CourseDetails = {
  course: {
    id: string;
    title: string;
    description: string;
    level?: CourseLevel;
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

function getCourseLevelLabel(level?: CourseLevel) {
  if (level === "intermediate") return "Средний";
  if (level === "advanced") return "Продвинутый";
  return "Начальный";
}

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
      setCourseTitle(data.course.title ?? "");
      setCourseDescription(data.course.description ?? "");
      setCourseLevel(data.course.level ?? "beginner");
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
      if (
        details &&
        (details.course.title !== courseTitle ||
          details.course.description !== courseDescription ||
          details.course.level !== courseLevel)
      ) {
        const courseResponse = await fetch(
          `${API_URL}/api/teacher/courses/${id}`,
          {
            credentials: "include",
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: courseTitle,
              description: courseDescription,
              level: courseLevel,
            }),
          },
        );

        const courseData = (await courseResponse.json()) as {
          message?: string;
        };
        if (!courseResponse.ok) {
          setError(courseData.message ?? "Не удалось обновить курс");
          return;
        }
      }

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
      resetCreateLessonDraft();
      setIsCreateLessonOpen(false);
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

  const selectedLesson =
    lessons.find((lesson) => lesson.id === editingLessonId) ??
    lessons[0] ??
    null;

  const handleSaveChanges = async () => {
    if (editingLessonId) {
      await saveLessonEdit();
      return;
    }

    if (isCreateLessonOpen) {
      await createLesson();
      return;
    }

    setError("Выберите урок для редактирования или откройте создание урока");
  };

  return (
    <main className="space-y-4 rounded-2xl bg-slate-50 p-3 text-slate-800 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-2xl font-semibold leading-tight text-slate-900">
          Настройки курса & Редактирование уроков
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/teacher/courses"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Назад
          </Link>
          <button
            type="button"
            onClick={() => void handleSaveChanges()}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-600 bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            <Save className="h-4 w-4" />
            Сохранить изменения
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
            {lessons.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Уроков пока нет.
              </p>
            ) : (
              lessons.map((lesson, index) => (
                <article
                  key={lesson.id}
                  className={`rounded-lg border px-3 py-2 ${
                    selectedLesson?.id === lesson.id
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => openEditLesson(lesson)}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2
                        className={`h-4 w-4 ${
                          lesson.isVisibleToStudents
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      />
                      <span className="text-lg font-medium">
                        {index + 1}. {lesson.title}
                      </span>
                    </span>
                  </button>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => askDeleteLesson(lesson.id, lesson.title)}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-sm text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Удалить
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleLessonVisibility(
                          lesson.id,
                          lesson.isVisibleToStudents,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {lesson.isVisibleToStudents
                        ? "Скрыть урок"
                        : "Показать урок"}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsCreateLessonOpen(true);
              setShowEditAssignmentInput(false);
              closeEditLesson();
            }}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            Добавить урок
          </button>
        </aside>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          {isCreateLessonOpen ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">
                Создание нового урока
              </p>
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Название урока"
                value={lessonTitle}
                onChange={(event) => setLessonTitle(event.target.value)}
              />
              <textarea
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                <button
                  type="button"
                  onClick={() => setShowAssignmentInput((prev) => !prev)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Добавить задание
                </button>
              </div>

              {showLinkInputs ? (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {lessonLinks.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Нажмите "Добавить ссылку", чтобы добавить строку.
                    </p>
                  ) : (
                    lessonLinks.map((link, index) => (
                      <div
                        key={`create-link-${index + 1}`}
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
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">
                    Можно загружать фото, видео, PDF и другие типы файлов.
                  </p>
                  <input
                    type="file"
                    className="w-full text-sm text-slate-700"
                    multiple
                    onChange={(event) =>
                      handleLessonFilesChange(event.target.files)
                    }
                  />
                  {lessonFiles.length > 0 ? (
                    <ul className="space-y-1 text-sm text-slate-700">
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

              {showAssignmentInput ? (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Поле задания"
                    value={assignmentText}
                    onChange={(event) => setAssignmentText(event.target.value)}
                  />
                  <div>
                    <label className="text-xs text-slate-600">Дедлайн</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      value={assignmentDueAt}
                      onChange={(event) =>
                        setAssignmentDueAt(event.target.value)
                      }
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void createLesson()}
                  disabled={creatingLesson || !lessonTitle.trim()}
                  className="rounded-lg border border-blue-400/70 bg-blue-700/80 px-3 py-1.5 text-sm text-white hover:bg-blue-600/90 disabled:opacity-60"
                >
                  {creatingLesson ? "Сохранение..." : "Сохранить урок"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    resetCreateLessonDraft();
                    setIsCreateLessonOpen(false);
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
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
                  <label className="text-sm text-slate-600">
                    Название курса
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={courseTitle}
                    onChange={(event) => setCourseTitle(event.target.value)}
                    disabled={!editingLessonId}
                  />

                  <label className="mt-3 block text-sm text-slate-600">
                    Описание курса
                  </label>
                  <textarea
                    className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    value={courseDescription}
                    onChange={(event) =>
                      setCourseDescription(event.target.value)
                    }
                    disabled={!editingLessonId}
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
                    disabled={!editingLessonId}
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
                    <option>Активен</option>
                    <option>Черновик</option>
                  </select>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <p>Дата создания: {details ? "21.07.2022 12:54" : "-"}</p>
                    <p className="mt-1">
                      Последнее обновление: {details ? "29.07.2022 18:39" : "-"}
                    </p>
                  </div>
                </article>

                <article className="rounded-lg border border-slate-200 bg-white p-3">
                  <label className="text-sm text-slate-600">
                    Название урока
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    placeholder="Название урока"
                    value={
                      editingLessonId
                        ? editLessonTitle
                        : (selectedLesson?.title ?? "")
                    }
                    onChange={(event) => setEditLessonTitle(event.target.value)}
                    disabled={!editingLessonId}
                  />

                  <label className="mt-3 block text-sm text-slate-600">
                    Описание урока
                  </label>
                  <textarea
                    className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    placeholder="Описание урока"
                    value={
                      editingLessonId
                        ? editLessonDescription
                        : (selectedLesson?.description ?? "")
                    }
                    onChange={(event) =>
                      setEditLessonDescription(event.target.value)
                    }
                    disabled={!editingLessonId}
                  />

                  <label className="mt-3 block text-sm text-slate-600">
                    Материалы урока
                  </label>
                  <div className="mt-1 rounded-lg border border-slate-300 bg-slate-50 p-3">
                    {selectedLesson?.materials.length ? (
                      <ul className="space-y-2 text-sm text-slate-700">
                        {selectedLesson.materials.map(
                          (material, materialIndex) => {
                            const materialUrl =
                              String(material.url ?? "") ||
                              toDataUrl(material.file);
                            const fileName = toFileName(material.file);

                            return (
                              <li
                                key={`${selectedLesson.id}-material-${materialIndex + 1}`}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1.5"
                              >
                                <p className="truncate font-medium">
                                  {String(
                                    material.title ??
                                      `Материал ${materialIndex + 1}`,
                                  )}
                                </p>
                                {materialUrl ? (
                                  <a
                                    href={materialUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-700 hover:underline"
                                  >
                                    {fileName || materialUrl}
                                  </a>
                                ) : null}
                              </li>
                            );
                          },
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Материалы пока не добавлены
                      </p>
                    )}
                  </div>

                  {editingLessonId ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowEditLinkInputs(true);
                            setEditLessonLinks((prev) => [...prev, ""]);
                          }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Добавить ссылку
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowEditFileInput((prev) => !prev)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Добавить файлы
                        </button>
                      </div>

                      {showEditLinkInputs ? (
                        <div className="space-y-2">
                          {editLessonLinks.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              Нажмите "Добавить ссылку", чтобы добавить строку.
                            </p>
                          ) : (
                            editLessonLinks.map((link, index) => (
                              <div
                                key={`inline-edit-link-${index + 1}`}
                                className="flex gap-2"
                              >
                                <input
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
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
                                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
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
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <input
                            type="file"
                            className="w-full text-sm text-slate-700"
                            multiple
                            onChange={(event) =>
                              handleEditLessonFilesChange(event.target.files)
                            }
                          />
                          {editLessonFiles.length > 0 ? (
                            <ul className="space-y-1 text-sm text-slate-700">
                              {editLessonFiles.map((file, index) => (
                                <li
                                  key={`${file.name}-${file.size}-${index}`}
                                  className="flex items-center justify-between gap-2"
                                >
                                  <span>{file.name}</span>
                                  <button
                                    type="button"
                                    className="text-rose-700 hover:underline"
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
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLesson && !editingLessonId) {
                          openEditLesson(selectedLesson);
                        }
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {editingLessonId
                        ? "Урок в режиме редактирования"
                        : "Редактировать урок"}
                    </button>

                    {selectedLesson ? (
                      <button
                        type="button"
                        onClick={() =>
                          askDeleteLesson(
                            selectedLesson.id,
                            selectedLesson.title,
                          )
                        }
                        className="inline-flex items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-rose-700 hover:bg-rose-100"
                        aria-label="Удалить урок"
                        title="Удалить урок"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      onClick={() => {
                        if (selectedLesson && !editingLessonId) {
                          openEditLesson(selectedLesson);
                        }
                        setShowEditAssignmentInput((prev) => !prev);
                      }}
                    >
                      + Добавить задание
                    </button>
                  </div>
                </article>
              </div>

              {showEditAssignmentInput ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="Поле задания"
                    value={editAssignmentText}
                    onChange={(event) =>
                      setEditAssignmentText(event.target.value)
                    }
                  />
                  <div className="mt-2">
                    <label className="text-xs text-slate-600">Дедлайн</label>
                    <input
                      type="datetime-local"
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                      value={editAssignmentDueAt}
                      onChange={(event) =>
                        setEditAssignmentDueAt(event.target.value)
                      }
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>

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
