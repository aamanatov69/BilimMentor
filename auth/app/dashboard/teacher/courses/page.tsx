"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  BookOpen,
  Copy,
  Download,
  ImageUp,
  MessageCircle,
  Plus,
  QrCode,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "students" | "title">(
    "newest",
  );
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
  const [shareCourseId, setShareCourseId] = useState("");
  const [shareCourseTitle, setShareCourseTitle] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shareInviteExpiresAt, setShareInviteExpiresAt] = useState("");
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [isQrGenerating, setIsQrGenerating] = useState(false);
  const [isQrSending, setIsQrSending] = useState(false);
  const isCreated = searchParams.get("created") === "1";

  const shareText = shareCourseTitle
    ? `Присоединяйтесь к курсу \"${shareCourseTitle}\" в BilimMentor`
    : "Присоединяйтесь к курсу в BilimMentor";
  const whatsappShareUrl = shareLink
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareLink}`)}`
    : "#";
  const telegramShareUrl = shareLink
    ? `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`
    : "#";

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

  useEffect(() => {
    let cancelled = false;

    const generateQrCode = async () => {
      if (!shareLink) {
        setQrCodeDataUrl("");
        setIsQrGenerating(false);
        return;
      }

      setIsQrGenerating(true);
      try {
        const dataUrl = await QRCode.toDataURL(shareLink, {
          width: 320,
          margin: 1,
          color: {
            dark: "#0f172a",
            light: "#ffffff",
          },
        });
        if (!cancelled) {
          setQrCodeDataUrl(dataUrl);
        }
      } catch {
        if (!cancelled) {
          setQrCodeDataUrl("");
          setShareError("Не удалось сгенерировать QR-код");
        }
      } finally {
        if (!cancelled) {
          setIsQrGenerating(false);
        }
      }
    };

    void generateQrCode();

    return () => {
      cancelled = true;
    };
  }, [shareLink]);

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

  const closeShareModal = () => {
    if (isShareLoading) {
      return;
    }

    setShareCourseId("");
    setShareCourseTitle("");
    setShareLink("");
    setShareInviteExpiresAt("");
    setShareError("");
    setIsShareCopied(false);
    setQrCodeDataUrl("");
    setIsQrGenerating(false);
    setIsQrSending(false);
  };

  const openShareModal = async (courseId: string, courseTitle: string) => {
    setShareCourseId(courseId);
    setShareCourseTitle(courseTitle);
    setShareLink("");
    setShareInviteExpiresAt("");
    setShareError("");
    setIsShareCopied(false);
    setQrCodeDataUrl("");
    setIsQrSending(false);
    setIsShareLoading(true);

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${courseId}/share-invite`,
        {
          credentials: "include",
        },
      );

      const data = (await response.json()) as {
        inviteToken?: string;
        expiresAt?: string | null;
        message?: string;
      };

      if (!response.ok || !data.inviteToken) {
        setShareError(data.message ?? "Не удалось создать ссылку для курса");
        return;
      }

      const appBase = window.location.origin.replace(/\/$/, "");
      const registerUrl = `${appBase}/register?courseInvite=${encodeURIComponent(data.inviteToken)}`;

      setShareLink(registerUrl);
      setShareInviteExpiresAt(data.expiresAt ?? "");
    } catch {
      setShareError("Ошибка сети при создании ссылки для курса");
    } finally {
      setIsShareLoading(false);
    }
  };

  const copyShareLink = async () => {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setIsShareCopied(true);
      window.setTimeout(() => setIsShareCopied(false), 1800);
    } catch {
      setShareError("Не удалось скопировать ссылку");
    }
  };

  const downloadQrCode = () => {
    if (!qrCodeDataUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrCodeDataUrl;
    anchor.download = `bilimmentor-course-${shareCourseId || "invite"}-qrcode.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };

  const shareQrCodeImage = async () => {
    if (!qrCodeDataUrl) {
      return;
    }

    if (
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function"
    ) {
      setShareError(
        "На этом устройстве отправка фото QR не поддерживается. Скачайте файл и отправьте вручную.",
      );
      return;
    }

    setIsQrSending(true);
    setShareError("");
    try {
      const imageResponse = await fetch(qrCodeDataUrl);
      const imageBlob = await imageResponse.blob();
      const qrFile = new File(
        [imageBlob],
        `bilimmentor-course-${shareCourseId || "invite"}-qrcode.png`,
        { type: "image/png" },
      );

      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [qrFile] })
      ) {
        await navigator.share({
          title: `QR-код курса ${shareCourseTitle}`,
          text: `${shareText}\n${shareLink}`,
          files: [qrFile],
        });
      } else {
        setShareError(
          "Отправка фото QR недоступна в вашем браузере. Используйте кнопку Скачать.",
        );
      }
    } catch {
      setShareError("Не удалось отправить фото QR-кода");
    } finally {
      setIsQrSending(false);
    }
  };

  const displayedCourses = [...courses]
    .filter((course) => {
      if (statusFilter === "published" && !course.isPublished) {
        return false;
      }
      if (statusFilter === "draft" && course.isPublished) {
        return false;
      }

      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return true;
      }

      return `${course.title} ${course.category} ${course.description}`
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => {
      if (sortBy === "students") {
        return (b.studentsCount ?? 0) - (a.studentsCount ?? 0);
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title, "ru-RU", {
          sensitivity: "base",
        });
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

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

      {!viewCourseId ? (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 md:grid-cols-[1.4fr_auto_auto]">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск по курсам"
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
            />
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | "published" | "draft",
                )
              }
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
            >
              <option value="all">Все статусы</option>
              <option value="published">Опубликованные</option>
              <option value="draft">Черновики</option>
            </select>
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "newest" | "students" | "title")
              }
              className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
            >
              <option value="newest">Сначала новые</option>
              <option value="students">По числу студентов</option>
              <option value="title">По названию</option>
            </select>
          </div>
        </section>
      ) : null}

      {!viewCourseId && displayedCourses.length === 0 ? (
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
          {displayedCourses.map((course) => (
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
                <button
                  type="button"
                  onClick={() => void openShareModal(course.id, course.title)}
                  className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Поделиться
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
              {displayedCourses.map((course) => (
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
                        onClick={() =>
                          void openShareModal(course.id, course.title)
                        }
                        className="inline-flex items-center justify-center rounded border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 hover:bg-sky-100"
                        aria-label="Поделиться курсом"
                        title="Поделиться"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
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

      {shareCourseId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Поделиться курсом
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  {shareCourseTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={closeShareModal}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {shareError ? (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {shareError}
              </p>
            ) : null}

            {isShareLoading ? (
              <p className="mt-4 text-sm text-slate-600">
                Подготавливаем ссылку приглашения...
              </p>
            ) : shareLink ? (
              <div className="mt-4 grid gap-4 md:grid-cols-[1fr_240px]">
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    Отправьте ссылку или QR-код. После регистрации по ним
                    студент автоматически получит доступ к курсу.
                  </p>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Ссылка для регистрации
                    </p>
                    <p className="break-all text-sm text-slate-800">
                      {shareLink}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copyShareLink()}
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      {isShareCopied ? "Скопировано" : "Копировать ссылку"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={whatsappShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                    <a
                      href={telegramShareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-100"
                    >
                      <Send className="h-4 w-4" />
                      Telegram
                    </a>
                  </div>

                  {shareInviteExpiresAt ? (
                    <p className="text-xs text-slate-500">
                      Ссылка действует до{" "}
                      {new Date(shareInviteExpiresAt).toLocaleString("ru-RU")}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <QrCode className="h-4 w-4" />
                    QR код курса
                  </p>
                  {isQrGenerating ? (
                    <div className="flex h-52 w-52 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                      Генерация QR...
                    </div>
                  ) : qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="QR-код приглашения на курс"
                      className="h-52 w-52 rounded-lg border border-slate-200 bg-white object-contain"
                    />
                  ) : (
                    <div className="flex h-52 w-52 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
                      QR недоступен
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={downloadQrCode}
                      disabled={!qrCodeDataUrl || isQrGenerating}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      Скачать QR
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareQrCodeImage()}
                      disabled={!qrCodeDataUrl || isQrGenerating || isQrSending}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ImageUp className="h-4 w-4" />
                      {isQrSending ? "Отправка..." : "Отправить QR фото"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
