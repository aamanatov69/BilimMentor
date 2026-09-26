"use client";

import { apiFetch } from "@/lib/api-client";

import { CourseNavigation } from "@/components/dashboard/course-navigation";
import { apiJson, apiErrorMessage } from "@/lib/api-client";

import { LoadError } from "@/components/ui/load-error";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Suspense, useEffect, useRef, useState } from "react";
import { CourseListSection } from "./course-list-section";
import { LessonListSection } from "./lesson-list-section";
import { ShareCourseModal } from "./share-course-modal";

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
  return <Suspense fallback={<p role="status">Загрузка…</p>}><TeacherCoursesContent /></Suspense>;
}

function TeacherCoursesContent() {
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
  const [coursesError, setCoursesError] = useState("");
  const [lessonsError, setLessonsError] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(true);
  const coursesRequest = useRef<AbortController | null>(null);
  const lessonsRequest = useRef<AbortController | null>(null);
  const [busyCourseId, setBusyCourseId] = useState("");
  const [busyLessonId, setBusyLessonId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [endCourseId, setEndCourseId] = useState("");
  const [endCourseTitle, setEndCourseTitle] = useState("");
  const [isEndingCourse, setIsEndingCourse] = useState(false);
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
  const isCreated = searchParams.get("created") === "1";

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
    coursesRequest.current?.abort();
    const controller = new AbortController();
    coursesRequest.current = controller;
    setLoadingCourses(true);
    setCoursesError("");
    try {
      const data = await apiJson<{ courses?: CourseItem[] }>("/api/teacher/courses", { signal: controller.signal });
      if (!controller.signal.aborted) setCourses(data.courses ?? []);
    } catch (error) {
      if (!controller.signal.aborted) setCoursesError(apiErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoadingCourses(false);
    }
  };

  const loadCourseLessons = async (courseId: string, courseTitle: string) => {
    lessonsRequest.current?.abort();
    const controller = new AbortController();
    lessonsRequest.current = controller;
    setViewCourseId(courseId);
    setViewCourseTitle(courseTitle);
    setViewLessons([]);
    setIsLoadingLessons(true);
    setLessonsError("");
    try {
      const data = await apiJson<{ course?: { modules?: Array<Record<string, unknown>> } }>(
        `/api/teacher/courses/${encodeURIComponent(courseId)}/details`, { signal: controller.signal },
      );
      if (!controller.signal.aborted) setViewLessons(mapLessons(data.course?.modules));
    } catch (error) {
      if (!controller.signal.aborted) setLessonsError(apiErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setIsLoadingLessons(false);
    }
  };

  useEffect(() => {
    void loadCourses();
    return () => { coursesRequest.current?.abort(); lessonsRequest.current?.abort(); };
  }, []);

  useEffect(() => {
    lessonsRequest.current?.abort();
    const courseId = searchParams.get("course")?.trim() ?? "";
    setViewCourseId(courseId);
    setViewCourseTitle("");
    setViewLessons([]);
    setLessonsError("");
    setIsLoadingLessons(Boolean(courseId));
    if (!courseId || loadingCourses || coursesError) return;
    const course = courses.find((item) => item.id === courseId);
    if (!course) {
      setLessonsError("Курс не найден или больше недоступен. Вернитесь к списку курсов.");
      setIsLoadingLessons(false);
      return;
    }
    void loadCourseLessons(courseId, course.title);
    return () => lessonsRequest.current?.abort();
  }, [searchParams, courses, loadingCourses, coursesError]);

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
      const response = await apiFetch(
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

  const openEndCourseModal = (courseId: string, courseTitle: string) => {
    setEndCourseId(courseId);
    setEndCourseTitle(courseTitle);
    setError("");
  };

  const closeEndCourseModal = () => {
    if (isEndingCourse) {
      return;
    }

    setEndCourseId("");
    setEndCourseTitle("");
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
      const response = await apiFetch(
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

  const completeCourse = async () => {
    if (!endCourseId) {
      return;
    }

    setIsEndingCourse(true);
    setError("");
    try {
      const response = await apiFetch(
        `${API_URL}/api/teacher/courses/${endCourseId}/complete`,
        {
          credentials: "include",
          method: "PATCH",
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось завершить курс");
        return;
      }

      setEndCourseId("");
      setEndCourseTitle("");
      await loadCourses();
    } catch {
      setError("Ошибка сети при завершении курса");
    } finally {
      setIsEndingCourse(false);
    }
  };

  const toggleLessonVisibility = async (
    courseId: string,
    lesson: CourseLessonItem,
  ) => {
    setBusyLessonId(lesson.id);
    setError("");

    try {
      const response = await apiFetch(
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
      const response = await apiFetch(
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
  };

  const openShareModal = async (courseId: string, courseTitle: string) => {
    setShareCourseId(courseId);
    setShareCourseTitle(courseTitle);
    setShareLink("");
    setShareInviteExpiresAt("");
    setShareError("");
    setIsShareCopied(false);
    setQrCodeDataUrl("");
    setIsShareLoading(true);

    try {
      const data = await apiJson<{
        inviteToken?: string;
        expiresAt?: string | null;
        message?: string;
      }>(`/api/teacher/courses/${encodeURIComponent(courseId)}/share-invite`);

      if (!data.inviteToken) {
        setShareError(data.message ?? "Не удалось создать ссылку для курса");
        return;
      }

      const appBase = window.location.origin.replace(/\/$/, "");
      const registerUrl = `${appBase}/register?courseInvite=${encodeURIComponent(data.inviteToken)}`;

      setShareLink(registerUrl);
      setShareInviteExpiresAt(data.expiresAt ?? "");
    } catch (error) {
      setShareError(apiErrorMessage(error));
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
      <CourseNavigation courseId={viewCourseId} active="courses" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {viewCourseId ? "Уроки" : "Курсы"}
        </h1>
        {viewCourseId ? (
          <Link
            href="/dashboard/teacher/courses"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Назад к курсам
          </Link>
        ) : (
          <Link
            href="/dashboard/teacher/courses/new?reset=1"
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

      {loadingCourses ? <p role="status" className="mt-4 text-sm text-slate-600">Загрузка курсов…</p> : coursesError ? (
        <LoadError message={coursesError} onRetry={() => void loadCourses()} />
      ) : null}
      {!loadingCourses && !coursesError && viewCourseId && lessonsError ? (
        <LoadError message={lessonsError} onRetry={() => void loadCourses()} />
      ) : null}

      {viewCourseId && !loadingCourses && !coursesError && !lessonsError ? (
        <LessonListSection
          viewCourseId={viewCourseId}
          viewCourseTitle={viewCourseTitle}
          viewLessons={viewLessons}
          isLoadingLessons={isLoadingLessons}
          busyLessonId={busyLessonId}
          onToggleLessonVisibility={(lesson) => void toggleLessonVisibility(viewCourseId, lesson)}
          onOpenDeleteLessonModal={(lessonId, lessonTitle) => openDeleteLessonModal(viewCourseId, lessonId, lessonTitle)}
        />
      ) : null}

      {!viewCourseId && !loadingCourses && !coursesError ? (
        <CourseListSection
          displayedCourses={displayedCourses}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          getLessonsCount={getLessonsCount}
          busyCourseId={busyCourseId}
          endCourseId={endCourseId}
          isEndingCourse={isEndingCourse}
          onLoadCourseLessons={(courseId) => window.history.pushState(null, "", `/dashboard/teacher/courses?course=${encodeURIComponent(courseId)}`)}
          onUpdateVisibility={(courseId, isPublished) => void updateVisibility(courseId, isPublished)}
          onOpenEndCourseModal={openEndCourseModal}
          onOpenDeleteModal={openDeleteModal}
          onOpenShareModal={(courseId, courseTitle) => void openShareModal(courseId, courseTitle)}
        />
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
        isOpen={Boolean(endCourseId)}
        title="Завершить курс?"
        description={
          endCourseTitle
            ? `Курс \"${endCourseTitle}\" будет завершен и скрыт для новых студентов.`
            : "Курс будет завершен и скрыт для новых студентов."
        }
        confirmText="Завершить курс"
        cancelText="Отмена"
        isBusy={isEndingCourse}
        onCancel={closeEndCourseModal}
        onConfirm={() => void completeCourse()}
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

      <ShareCourseModal
        shareCourseId={shareCourseId}
        shareCourseTitle={shareCourseTitle}
        shareLink={shareLink}
        shareInviteExpiresAt={shareInviteExpiresAt}
        isShareLoading={isShareLoading}
        shareError={shareError}
        isShareCopied={isShareCopied}
        qrCodeDataUrl={qrCodeDataUrl}
        isQrGenerating={isQrGenerating}
        onClose={closeShareModal}
        onCopyShareLink={() => void copyShareLink()}
        onDownloadQrCode={downloadQrCode}
        onRetry={() => void openShareModal(shareCourseId, shareCourseTitle)}
      />
    </main>
  );
}
