"use client";

import { apiFetch } from "@/lib/api-client";

import { StatusBadge } from "@/components/ui/status-badge";

import { EmptyState } from "@/components/ui/empty-state";

import { apiJson, apiErrorMessage } from "@/lib/api-client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast-provider";
import Link from "next/link";
import { LoadError } from "@/components/ui/load-error";
import { useSearchParams } from "next/navigation";
import { CourseActions } from "./course-actions";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseItem = {
  id: string;
  title: string;
  teacherId: string;
  teacherName: string;
  students: number;
  isPublished: boolean;
  createdAt: string;
};

type TeacherItem = {
  id: string;
  fullName: string;
  role: "student" | "teacher" | "admin";
};

type ReportItem = {
  courseId: string;
  students: number;
};

export default function AdminCoursesPage() {
  return <Suspense fallback={<p role="status">Загрузка курсов…</p>}><AdminCoursesContent /></Suspense>;
}

function AdminCoursesContent() {
  const toast = useToast();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [enrollmentByCourse, setEnrollmentByCourse] = useState<ReportItem[]>(
    [],
  );
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isMassActionRunning, setIsMassActionRunning] = useState(false);
  const [error, setError] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const filterKey = searchParams.toString();
  const query = (searchParams.get("q") ?? "").slice(0, 200);
  const statusValue = searchParams.get("status");
  const statusFilter = statusValue === "published" || statusValue === "hidden" ? statusValue : "all";
  const teacherFilter = (searchParams.get("teacher") ?? "").slice(0, 64);
  const pageValue = Number(searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 1_000_000 ? pageValue : 1;
  const sortValue = searchParams.get("sort");
  const sort = sortValue === "oldest" || sortValue === "title" ? sortValue : "newest";

  const updateFilters = (values: Record<string, string>, replace = false) => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (!value || (key === "page" && value === "1") || (key === "status" && value === "all") || (key === "sort" && value === "newest")) params.delete(key);
      else params.set(key, value);
    }
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    if (nextUrl === `${window.location.pathname}${window.location.search}`) return;
    setSelectedCourseIds([]);
    setLoading(true);
    if (replace) window.history.replaceState(null, "", nextUrl);
    else window.history.pushState(null, "", nextUrl);
  };
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ courses: 0, published: 0, enrollments: 0 });
  const activeRequest = useRef<AbortController | null>(null);

  const loadData = async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", sort, status: statusFilter, teacher: teacherFilter, q: query });
      const data = await apiJson<{
        courses: CourseItem[];
        teachers: TeacherItem[];
        pagination: { page: number; total: number; totalPages: number };
        summary: { courses: number; published: number; enrollments: number };
      }>(`/api/admin/courses?${params}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setCourses(data.courses);
      setTeachers(data.teachers);
      setPagination(data.pagination);
      setSummary(data.summary);
      setEnrollmentByCourse(data.courses.map((course: CourseItem) => ({ courseId: course.id, students: course.students })));
      setSelectedCourseIds([]);
      if (data.pagination.page !== page) updateFilters({ page: String(data.pagination.page) }, true);
    } catch (error) {
      if (controller.signal.aborted) return;
      setError(apiErrorMessage(error));
      toast.error("Ошибка загрузки курсов");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setSelectedCourseIds([]);
    activeRequest.current?.abort();
    const timer = window.setTimeout(() => void loadData(), 250);
    return () => { window.clearTimeout(timer); activeRequest.current?.abort(); };
  }, [filterKey]);

  const openDeleteModal = (courseId: string, title: string) => {
    setDeleteCourseId(courseId);
    setDeleteCourseTitle(title);
    setError("");
  };

  const closeDeleteModal = () => {
    if (isDeletingCourse) {
      return;
    }
    setDeleteCourseId("");
    setDeleteCourseTitle("");
  };

  const deleteCourse = async () => {
    if (!deleteCourseId) {
      return;
    }

    setIsDeletingCourse(true);
    setError("");
    try {
      const response = await apiFetch(
        `${API_URL}/api/admin/courses/${deleteCourseId}`,
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
      toast.success("Курс удален");
      await loadData();
    } catch {
      setError("Ошибка сети");
      toast.error("Ошибка удаления курса");
    } finally {
      setIsDeletingCourse(false);
    }
  };

  const selectedSet = useMemo(
    () => new Set(selectedCourseIds),
    [selectedCourseIds],
  );

  const enrollmentsByCourse = useMemo(
    () =>
      enrollmentByCourse.reduce<Record<string, number>>((acc, item) => {
        acc[item.courseId] = item.students;
        return acc;
      }, {}),
    [enrollmentByCourse],
  );

  const totalStudents = summary.enrollments;
  const publishedCount = summary.published;

  const runMassPublish = async (isPublished: boolean) => {
    if (!selectedCourseIds.length) {
      toast.info("Сначала выберите курсы");
      return;
    }

    setIsMassActionRunning(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/api/admin/courses/bulk`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: isPublished ? "publish" : "unpublish",
          courseIds: selectedCourseIds,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        affectedCount?: number;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось выполнить массовое действие");
        toast.error(data.message ?? "Не удалось выполнить массовое действие");
        return;
      }

      const okCount = data.affectedCount ?? 0;
      setSelectedCourseIds([]);
      toast.success(
        isPublished
          ? `Опубликовано курсов: ${okCount}`
          : `Скрыто курсов: ${okCount}`,
      );
      await loadData();
    } catch {
      setError("Ошибка сети");
      toast.error("Не удалось выполнить массовое действие");
    } finally {
      setIsMassActionRunning(false);
    }
  };

  const runMassDelete = async () => {
    if (!selectedCourseIds.length) {
      toast.info("Сначала выберите курсы");
      return;
    }

    setIsMassActionRunning(true);
    setError("");
    try {
      const response = await apiFetch(`${API_URL}/api/admin/courses/bulk`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          courseIds: selectedCourseIds,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        affectedCount?: number;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить выбранные курсы");
        toast.error(data.message ?? "Не удалось удалить выбранные курсы");
        return;
      }

      const okCount = data.affectedCount ?? 0;
      setSelectedCourseIds([]);
      toast.success(`Удалено курсов: ${okCount}`);
      setMassDeleteOpen(false);
      await loadData();
    } catch {
      setError("Ошибка сети");
      toast.error("Не удалось удалить выбранные курсы");
    } finally {
      setIsMassActionRunning(false);
    }
  };

  const teacherById = useMemo(
    () =>
      teachers.reduce<Record<string, string>>((acc, item) => {
        acc[item.id] = item.fullName;
        return acc;
      }, {}),
    [teachers],
  );

  const visibleCourses = courses;


  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">
          Управление курсами
        </h1>
        <Link
          href="/dashboard/admin/courses/new"
          className="w-full rounded bg-blue-700 px-3 py-2 text-center text-sm text-white hover:bg-blue-800 sm:w-auto"
        >
          Создать курс
        </Link>
      </div>

      {error ? <LoadError message={error} busy={loading} onRetry={() => void loadData()} /> : null}

      <section className="mt-4 grid gap-2 sm:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Всего курсов</p>
          <p className="text-xl font-semibold text-slate-900">
            {loading ? "…" : summary.courses}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Опубликовано</p>
          <p className="text-xl font-semibold text-emerald-700">
            {loading ? "…" : publishedCount}
          </p>
        </article>
        <article className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Записей на курсы</p>
          <p className="text-xl font-semibold text-slate-900">
            {loading ? "…" : totalStudents}
          </p>
        </article>
      </section>

      <fieldset disabled={isMassActionRunning || isDeletingCourse} aria-label="Фильтры курсов" className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-slate-700">Поиск по названию
          <input type="search" value={query} onChange={(event) => { updateFilters({ q: event.target.value, page: "1" }, true); }} placeholder="Название курса" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" />
        </label>
        <label className="text-sm text-slate-700">Статус
          <select value={statusFilter} onChange={(event) => { updateFilters({ status: event.target.value, page: "1" }); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
            <option value="all">Все статусы</option><option value="published">Опубликован</option><option value="hidden">Скрыт</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">Преподаватель
          <select value={teacherFilter} onChange={(event) => { updateFilters({ teacher: event.target.value, page: "1" }); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
            <option value="">Все преподаватели</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </select>
        </label>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p role="status">{loading ? "Загрузка…" : `Найдено курсов: ${pagination.total}`}</p>
        <label>Сортировка
          <select disabled={isMassActionRunning || isDeletingCourse} value={sort} onChange={(event) => { updateFilters({ sort: event.target.value, page: "1" }); }} className="ml-2 min-h-11 rounded-lg border border-slate-300 bg-white px-3">
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
            <option value="title">По названию</option>
          </select>
        </label>
      </div>

      {!loading && selectedCourseIds.length > 0 ? <section className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <button
          type="button"
          disabled={isMassActionRunning}
          onClick={() => void runMassPublish(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Опубликовать выбранные
        </button>
        <button
          type="button"
          disabled={isMassActionRunning}
          onClick={() => void runMassPublish(false)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          Скрыть выбранные
        </button>
        <button
          type="button"
          disabled={isMassActionRunning}
          onClick={() => setMassDeleteOpen(true)}
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
        >
          Удалить выбранные
        </button>
        <span className="ml-auto text-xs text-slate-500">
          Выбрано: {selectedCourseIds.length}
        </span>
      </section> : null}

      {loading ? <p role="status" className="mt-4 rounded-lg bg-slate-50 p-4 text-slate-600">Загрузка курсов…</p> : null}
      {!loading && !error && visibleCourses.length === 0 ? <EmptyState className="mt-4"
        title={summary.courses ? "Курсы не найдены" : "Курсов пока нет"}
        description={summary.courses ? "Попробуйте изменить название, статус или преподавателя." : "Создайте первый курс и добавьте в него уроки."}
        action={summary.courses ? <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold" onClick={() => updateFilters({ q: "", status: "all", teacher: "", page: "1" })}>Сбросить фильтры</button> : <Link href="/dashboard/admin/courses/new" className="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white">Создать курс</Link>}
      /> : null}

      <div className={`mt-4 space-y-3 ${loading || !visibleCourses.length ? "hidden" : "lg:hidden"}`}>
        {visibleCourses.length ? (
          visibleCourses.map((course) => (
            <article
              key={`mobile-${course.id}`}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Выбрать курс ${course.title}`}
                    disabled={isMassActionRunning}
                    className="mt-1"
                    checked={selectedSet.has(course.id)}
                    onChange={(event) =>
                      setSelectedCourseIds((previous) => {
                        if (event.target.checked) {
                          return [...new Set([...previous, course.id])];
                        }
                        return previous.filter((item) => item !== course.id);
                      })
                    }
                  />
                  <div>
                    <p className="font-medium text-slate-900">
                      {course.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      Преподаватель:{" "}
                      {course.teacherName ?? teacherById[course.teacherId] ?? "Преподаватель не назначен"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={course.isPublished ? "published" : "hidden"} />
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>
                  Студентов: {enrollmentsByCourse[course.id] ?? 0}
                </span>
                <span>
                  Создан: {new Date(course.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-start gap-3 text-sm">
                <Link href={`/dashboard/admin/courses/${course.id}/edit`} className="rounded-lg px-3 py-2 text-blue-700 hover:bg-blue-50">Редактировать</Link>
                <CourseActions id={course.id} title={course.title} disabled={isMassActionRunning || isDeletingCourse} onDelete={() => openDeleteModal(course.id, course.title)} />
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Курсы не найдены.
          </p>
        )}
      </div>

      <div className={`mobile-scroll mt-4 hidden overflow-x-auto ${!loading && visibleCourses.length ? "lg:block" : ""}`}>
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">
                <input
                  type="checkbox"
                  aria-label="Выбрать все показанные курсы"
                  disabled={isMassActionRunning}
                  checked={
                    visibleCourses.length > 0 &&
                    visibleCourses.every((course) => selectedSet.has(course.id))
                  }
                  onChange={(event) =>
                    setSelectedCourseIds(
                      event.target.checked
                        ? visibleCourses.map((item) => item.id)
                        : [],
                    )
                  }
                />
              </th>
              <th className="py-2 pr-3 font-medium">Название курса</th>
              <th className="py-2 pr-3 font-medium">Преподаватель</th>
              <th className="py-2 pr-3 font-medium">Количество студентов</th>
              <th className="py-2 pr-3 font-medium">Создан</th>
              <th className="py-2 pr-3 font-medium">Статус</th>
              <th className="py-2 pr-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {visibleCourses.map((course) => (
              <tr key={course.id} className="border-b border-slate-100">
                <td className="py-3 pr-3">
                  <input
                    type="checkbox"
                    aria-label={`Выбрать курс ${course.title}`}
                    disabled={isMassActionRunning}
                    checked={selectedSet.has(course.id)}
                    onChange={(event) =>
                      setSelectedCourseIds((previous) => {
                        if (event.target.checked) {
                          return [...new Set([...previous, course.id])];
                        }
                        return previous.filter((item) => item !== course.id);
                      })
                    }
                  />
                </td>
                <td className="py-3 pr-3"><Link href={`/dashboard/admin/courses/${course.id}/edit`} className="font-medium text-blue-700 hover:underline">{course.title}</Link></td>
                <td className="py-3 pr-3">
                  {course.teacherName ?? teacherById[course.teacherId] ?? "Преподаватель не назначен"}
                </td>
                <td className="py-3 pr-3">
                  {enrollmentsByCourse[course.id] ?? 0}
                </td>
                <td className="py-3 pr-3 text-xs text-slate-600">
                  {new Date(course.createdAt).toLocaleString("ru-RU")}
                </td>
                <td className="py-3 pr-3">
                  <StatusBadge status={course.isPublished ? "published" : "hidden"} />
                </td>
                <td className="py-3 pr-3">
                  <CourseActions id={course.id} title={course.title} disabled={isMassActionRunning || isDeletingCourse} onDelete={() => openDeleteModal(course.id, course.title)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav aria-label="Страницы курсов" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button type="button" disabled={loading || isMassActionRunning || isDeletingCourse || page <= 1} onClick={() => { updateFilters({ page: String(page - 1) }); }} className="min-h-11 rounded-lg border px-4 disabled:opacity-40">Предыдущая</button>
        <span>Страница {pagination.page} из {pagination.totalPages}</span>
        <button type="button" disabled={loading || isMassActionRunning || isDeletingCourse || page >= pagination.totalPages} onClick={() => { updateFilters({ page: String(page + 1) }); }} className="min-h-11 rounded-lg border px-4 disabled:opacity-40">Следующая</button>
      </nav>

      <ConfirmModal
        isOpen={massDeleteOpen}
        title={`Удалить выбранные курсы (${selectedCourseIds.length})?`}
        description={`Без возможности восстановления будут удалены: ${courses.filter((course) => selectedSet.has(course.id)).map((course) => course.title).join(", ")}.`}
        confirmText="Удалить курсы"
        isBusy={isMassActionRunning}
        onCancel={() => { if (!isMassActionRunning) setMassDeleteOpen(false); }}
        onConfirm={() => void runMassDelete()}
      />
      <ConfirmModal
        isOpen={Boolean(deleteCourseId)}
        title="Удалить курс?"
        description={
          deleteCourseTitle
            ? `Курс \"${deleteCourseTitle}\" будет удален без возможности восстановления.`
            : "Курс будет удален без возможности восстановления."
        }
        confirmText="Удалить курс"
        cancelText="Отмена"
        isBusy={isDeletingCourse}
        onCancel={closeDeleteModal}
        onConfirm={() => void deleteCourse()}
      />
    </main>
  );
}
