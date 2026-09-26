"use client";

import { LoadError } from "@/components/ui/load-error";
import { apiJson, apiErrorMessage } from "@/lib/api-client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { BookOpen, ClipboardCheck, Star, Users } from "lucide-react";
import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CourseListSection } from "./course-list-section";
import { ShareCourseModal } from "./share-course-modal";


type OverviewResponse = {
  summary?: {
    courses?: number;
    studentsEnrolled?: number;
    assignmentsToGrade?: number;
    pendingRequests?: number;
  };
  courses?: Array<{
    id: string;
    title: string;
    category?: string | null;
    progress?: number | null;
    isPublished?: boolean;
    createdAt?: string;
    modules?: Array<Record<string, unknown>>;
    studentsCount?: number;
  }>;
};

export type TeacherOverviewCourse = NonNullable<
  OverviewResponse["courses"]
>[number];

export default function TeacherDashboardPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "published" | "draft"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "students" | "title">(
    "newest",
  );
  const [busyCourseId, setBusyCourseId] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [endCourseId, setEndCourseId] = useState("");
  const [endCourseTitle, setEndCourseTitle] = useState("");
  const [isEndingCourse, setIsEndingCourse] = useState(false);
  const [shareCourseId, setShareCourseId] = useState("");
  const [shareCourseTitle, setShareCourseTitle] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shareInviteExpiresAt, setShareInviteExpiresAt] = useState("");
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [isQrGenerating, setIsQrGenerating] = useState(false);
  const [info, setInfo] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await apiJson<OverviewResponse>("/api/teacher/overview", { signal: controller.signal });
        if (!controller.signal.aborted) setOverview(data);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(apiErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadData();
    return () => controller.abort();
  }, [retry]);

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

  const cards = useMemo(
    () => [
      {
        title: "Курсы",
        value: overview?.summary?.courses ?? 0,
        icon: BookOpen,
        hint: "Активных курсов",
        color: "text-sky-700 bg-sky-100",
      },
      {
        title: "Студенты",
        value: overview?.summary?.studentsEnrolled ?? 0,
        icon: Users,
        hint: "Учатся у вас",
        color: "text-emerald-700 bg-emerald-100",
      },
      {
        title: "Новые заявки",
        value: overview?.summary?.pendingRequests ?? 0,
        icon: ClipboardCheck,
        hint: "Требуют ответа",
        color: "text-amber-700 bg-amber-100",
      },
      {
        title: "Задания на проверку",
        value: overview?.summary?.assignmentsToGrade ?? 0,
        icon: Star,
        hint: "Работ ожидают оценку",
        color: "text-rose-700 bg-rose-100",
      },
    ],
    [overview],
  );

  const displayedCourses = useMemo(() => {
    return [...(overview?.courses ?? [])]
      .filter((course) => {
        if (statusFilter === "published" && !course.isPublished) {
          return false;
        }

        if (statusFilter === "draft" && course.isPublished) {
          return false;
        }

        const text = `${course.title} ${course.category ?? ""}`.toLowerCase();
        return text.includes(searchQuery.toLowerCase().trim());
      })
      .sort((a, b) => {
        if (sortBy === "students") {
          return (b.studentsCount ?? 0) - (a.studentsCount ?? 0);
        }

        if (sortBy === "title") {
          return a.title.localeCompare(b.title, "ru");
        }

        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
      });
  }, [overview?.courses, searchQuery, sortBy, statusFilter]);

  const updateVisibility = async (courseId: string, isPublished: boolean) => {
    setBusyCourseId(courseId);
    setError("");
    setInfo("");

    try {
      await apiJson(
        `/api/teacher/courses/${encodeURIComponent(courseId)}/visibility`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isPublished }),
        },
      );

      setOverview((prev) => {
        if (!prev?.courses) {
          return prev;
        }

        return {
          ...prev,
          courses: prev.courses.map((course) =>
            course.id === courseId ? { ...course, isPublished } : course,
          ),
        };
      });
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally {
      setBusyCourseId("");
    }
  };

  const openDeleteModal = (courseId: string, courseTitle: string) => {
    setDeleteCourseId(courseId);
    setDeleteCourseTitle(courseTitle);
    setError("");
    setInfo("");
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
    setInfo("");
  };

  const closeEndCourseModal = () => {
    if (isEndingCourse) {
      return;
    }

    setEndCourseId("");
    setEndCourseTitle("");
  };

  const deleteCourse = async () => {
    if (!deleteCourseId) {
      return;
    }

    setIsDeletingCourse(true);
    setError("");
    setInfo("");

    try {
      await apiJson(
        `/api/teacher/courses/${encodeURIComponent(deleteCourseId)}`,
        {
          credentials: "include",
          method: "DELETE",
        },
      );

      setOverview((prev) => {
        if (!prev?.courses) {
          return prev;
        }

        const nextCourses = prev.courses.filter(
          (course) => course.id !== deleteCourseId,
        );
        const nextSummary = {
          ...(prev.summary ?? {}),
          courses: Math.max(0, nextCourses.length),
        };

        return {
          ...prev,
          summary: nextSummary,
          courses: nextCourses,
        };
      });

      setDeleteCourseId("");
      setDeleteCourseTitle("");
      setInfo("Курс удален");
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally {
      setIsDeletingCourse(false);
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
    setError("");
    setInfo("");

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

  const completeCourse = async () => {
    if (!endCourseId) {
      return;
    }

    setIsEndingCourse(true);
    setError("");
    setInfo("");

    try {
      await apiJson(
        `/api/teacher/courses/${encodeURIComponent(endCourseId)}/complete`,
        {
          credentials: "include",
          method: "PATCH",
        },
      );

      setOverview((prev) => {
        if (!prev?.courses) {
          return prev;
        }

        return {
          ...prev,
          courses: prev.courses.map((course) =>
            course.id === endCourseId
              ? { ...course, isPublished: false, progress: 100 }
              : course,
          ),
        };
      });

      setEndCourseId("");
      setEndCourseTitle("");
      setInfo("Курс завершен");
    } catch (error) {
      setError(apiErrorMessage(error));
    } finally {
      setIsEndingCourse(false);
    }
  };

  const assignmentsToGrade = overview?.summary?.assignmentsToGrade ?? 0;
  const pendingRequests = overview?.summary?.pendingRequests ?? 0;

  if (loading || loadError) {
    return (
      <main className="space-y-5">
        <h1 className="text-2xl font-semibold text-slate-900">Рабочий день преподавателя</h1>
        {loading ? (
          <p role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Загрузка курсов и статистики…</p>
        ) : (
          <LoadError message={loadError} onRetry={() => setRetry((value) => value + 1)} />
        )}
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h1 className="text-2xl font-semibold text-slate-900">Рабочий день преподавателя</h1>
        <p className="mt-2 text-slate-700">
          {loading ? "Загрузка очереди проверки…" : overview ? `Ожидают оценки: ${assignmentsToGrade}. Заявок на доступ: ${pendingRequests}.` : "Не удалось получить текущую нагрузку."}
        </p>
        <Link href="/dashboard/teacher/assignments" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800">Открыть очередь проверки</Link>
      </section>
      {error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  {card.title}
                </p>
                <span className={`rounded-lg p-2 ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {loading ? "..." : card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
            </article>
          );
        })}
      </section>

      <CourseListSection
        courses={displayedCourses}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        busyCourseId={busyCourseId}
        endCourseId={endCourseId}
        isEndingCourse={isEndingCourse}
        deleteCourseId={deleteCourseId}
        isDeletingCourse={isDeletingCourse}
        shareCourseId={shareCourseId}
        onUpdateVisibility={(courseId, isPublished) => void updateVisibility(courseId, isPublished)}
        onOpenEndCourseModal={openEndCourseModal}
        onOpenDeleteModal={openDeleteModal}
        onOpenShareModal={(courseId, courseTitle) => void openShareModal(courseId, courseTitle)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Требуют внимания</h2>
        <p className="mt-1 text-sm text-slate-600">Проверяйте ответы студентов и рассматривайте заявки на доступ к курсам.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link href="/dashboard/teacher/assignments" className="rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50">
            <span className="block font-semibold text-slate-900">Проверка работ · {assignmentsToGrade}</span>
            <span className="mt-1 block text-sm text-slate-600">{assignmentsToGrade ? "Открыть очередь и выставить оценки" : "Работ, ожидающих оценки, нет"}</span>
          </Link>
          <Link href="/dashboard/teacher/students?status=pending" className="rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:bg-blue-50">
            <span className="block font-semibold text-slate-900">Заявки на доступ · {pendingRequests}</span>
            <span className="mt-1 block text-sm text-slate-600">{pendingRequests ? "Открыть заявки, ожидающие решения" : "Новых заявок на доступ нет"}</span>
          </Link>
        </div>
      </section>

      <ConfirmModal
        isOpen={Boolean(endCourseId)}
        title="Завершить курс?"
        description={
          endCourseTitle
            ? `Курс "${endCourseTitle}" будет завершен и скрыт для новых студентов.`
            : "Курс будет завершен и скрыт для новых студентов."
        }
        confirmText="Завершить курс"
        cancelText="Отмена"
        tone="danger"
        isBusy={isEndingCourse}
        error={error}
        onCancel={closeEndCourseModal}
        onConfirm={() => void completeCourse()}
      />

      <ConfirmModal
        isOpen={Boolean(deleteCourseId)}
        title="Удалить курс?"
        description={
          deleteCourseTitle
            ? `Курс "${deleteCourseTitle}" будет удален без возможности восстановления.`
            : "Курс будет удален без возможности восстановления."
        }
        confirmText="Удалить"
        cancelText="Отмена"
        tone="danger"
        isBusy={isDeletingCourse}
        error={error}
        onCancel={closeDeleteModal}
        onConfirm={() => void deleteCourse()}
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
