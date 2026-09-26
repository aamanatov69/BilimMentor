"use client";

import { PageHeader } from "@/components/ui/page-header";
import { SearchFilter, SelectFilter } from "@/components/ui/list-filters";
import { LoadError } from "@/components/ui/load-error";
import { EmptyState } from "@/components/ui/empty-state";
import { apiJson, apiErrorMessage } from "@/lib/api-client";

import { CourseNavigation } from "@/components/dashboard/course-navigation";

import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";



type TeacherCourseItem = {
  id: string;
  title: string;
};

type TeacherCourseDetails = {
  course?: {
    id: string;
    title: string;
  };
  students?: Array<{
    id: string;
    fullName: string;
    email: string;
    phone?: string;
  }>;
};

type CourseStudentCard = {
  id: string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  courseId: string;
  requestId?: string;
  requestCourseTitle?: string;
  courseTitle: string;
  status: "approved" | "pending";
};

type AccessRequest = {
  id: string;
  courseId: string;
  status: "pending" | "approved" | "rejected";
  course?: { id: string; title: string };
  student?: { id: string; fullName: string; email: string };
};

export default function TeacherStudentsPage() {
  return <Suspense fallback={<p role="status">Загрузка…</p>}><TeacherStudentsContent /></Suspense>;
}

function TeacherStudentsContent() {
  const searchParams = useSearchParams();
  const selectedCourse = searchParams.get("course") ?? "";
  const search = searchParams.get("q") ?? "";
  const requestedStatus = searchParams.get("status");
  const statusFilter = requestedStatus === "pending" || requestedStatus === "approved"
    ? requestedStatus
    : "all";

  const updateFilters = (updates: Record<string, string>, replace = false) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(updates)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    if (nextUrl === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
    if (replace) window.history.replaceState(null, "", nextUrl);
    else window.history.pushState(null, "", nextUrl);
  };
  const [students, setStudents] = useState<CourseStudentCard[]>([]);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState("");
  const activeLoad = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const [mobileDataOpenById, setMobileDataOpenById] = useState<
    Record<string, boolean>
  >({});

  const loadStudents = async () => {
    if (!mounted.current) return;
    activeLoad.current?.abort();
    const controller = new AbortController();
    activeLoad.current = controller;
    const options = { signal: controller.signal };
    setLoadError("");
    setIsLoading(true);
    try {
      const [coursesPayload, requestPayload] = await Promise.all([
        apiJson<{ courses?: TeacherCourseItem[] }>("/api/teacher/courses", options),
        apiJson<{ requests?: AccessRequest[] }>("/api/teacher/course-access-requests?status=pending", options),
      ]);
      const courses = coursesPayload.courses ?? [];
      const pendingRequests = (requestPayload.requests ?? []).filter(
        (request) => request.status === "pending",
      );

      const detailsResponses = await Promise.all(
        courses.map(async (course) => {
          const detailsPayload = await apiJson<TeacherCourseDetails>(
            `/api/teacher/courses/${encodeURIComponent(course.id)}/details`,
            options,
          );
          return {
            course,
            students: detailsPayload.students ?? [],
          };
        }),
      );

      const mapByEnrollment = new Map<string, CourseStudentCard>();

      detailsResponses.forEach((entry) => {
        if (!entry) return;

        (entry.students ?? []).forEach((student) => {
          mapByEnrollment.set(`${entry.course.id}:${student.id}`, {
            id: `${entry.course.id}-${student.id}`,
            studentId: student.id,
            fullName: student.fullName,
            email: student.email,
            phone: student.phone ?? "",
            courseId: entry.course.id,
            courseTitle: entry.course.title,
            status: "approved",
          });
        });
      });

      pendingRequests.forEach((request) => {
        if (
          !request.student?.id ||
          !request.student.fullName ||
          !request.student.email
        ) {
          return;
        }

        const enrollmentKey = `${request.courseId}:${request.student.id}`;
        const current = mapByEnrollment.get(enrollmentKey);
        if (current?.status === "approved") return;
        mapByEnrollment.set(enrollmentKey, {
          id: current?.id ?? `pending-${request.id}`,
          studentId: request.student.id,
          fullName: request.student.fullName,
          email: request.student.email,
          phone: current?.phone ?? "",
          courseId: request.courseId,
          courseTitle: request.course?.title ?? courses.find((course) => course.id === request.courseId)?.title ?? "Курс",
          requestId: request.id,
          requestCourseTitle: request.course?.title,
          status: "pending",
        });
      });

      const sortedStudents = Array.from(mapByEnrollment.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "ru-RU", { sensitivity: "base" }),
      );

      if (!controller.signal.aborted) setStudents(sortedStudents);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(apiErrorMessage(error));
    } finally {
      if (activeLoad.current === controller) {
        if (mounted.current) setIsLoading(false);
        activeLoad.current = null;
      }
      controller.abort();
    }
  };

  const reviewRequest = async (
    requestId: string,
    status: "approved" | "rejected",
  ) => {
    setBusyRequestId(requestId);
    setError("");
    try {
      await apiJson(`/api/teacher/course-access-requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!mounted.current) return;

      // Оптимистично обновляем статус, чтобы студент не исчезал из списка
      if (status === "approved") {
        setStudents((prev) =>
          prev.map((s) =>
            s.requestId === requestId
              ? { ...s, status: "approved", requestId: undefined }
              : s,
          ),
        );
      } else {
        // При отклонении убираем студента из списка
        setStudents((prev) => prev.filter((s) => s.requestId !== requestId));
      }

      await loadStudents();
    } catch (error) {
      if (mounted.current) setError(apiErrorMessage(error));
    } finally {
      if (mounted.current) setBusyRequestId("");
    }
  };

  useEffect(() => {
    mounted.current = true;
    void loadStudents();
    return () => {
      mounted.current = false;
      activeLoad.current?.abort();
    };
  }, []);

  const courseStudents = students.filter((student) => !selectedCourse || student.courseId === selectedCourse);
  const query = search.trim().toLocaleLowerCase("ru-RU");
  const hasFilters = Boolean(query) || statusFilter !== "all";
  const visibleStudents = courseStudents.filter((student) =>
    (statusFilter === "all" || student.status === statusFilter) &&
    (!query || [student.fullName, student.email, student.phone, student.courseTitle]
      .some((value) => value.toLocaleLowerCase("ru-RU").includes(query))),
  );
  const resetFilters = () => {
    updateFilters({ q: "", status: "" });
  };

  return (
    <main className="space-y-6">
      <CourseNavigation courseId={selectedCourse} active="students" />
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title="Студенты" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <SearchFilter label="Поиск студентов" value={search} onChange={(value) => updateFilters({ q: value }, true)} placeholder="Имя, почта, телефон или курс" />
          <SelectFilter label="Доступ к курсу" value={statusFilter} onChange={(value) => updateFilters({ status: value === "all" ? "" : value })} options={[
            { value: "all", label: "Все записи" }, { value: "pending", label: "На рассмотрении" }, { value: "approved", label: "Доступ открыт" },
          ]} />
        </div>
        {hasFilters ? (
          <button type="button" onClick={resetFilters} className="mt-2 min-h-11 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            Сбросить поиск и статус
          </button>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Записи на курсы {isLoading || loadError ? "" : `(${visibleStudents.length} из ${courseStudents.length})`}
        </h2>

        {isLoading ? (
          <p role="status" className="text-sm text-slate-600">Загрузка студентов и заявок…</p>
        ) : loadError ? (
          <LoadError message={loadError} onRetry={() => void loadStudents()} />
        ) : visibleStudents.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Ничего не найдено" : "Записей на курсы пока нет"}
            description={hasFilters ? "Измените поисковый запрос или статус доступа." : "Здесь появятся студенты и заявки на доступ к курсам."}
            action={hasFilters ? (
              <button type="button" onClick={resetFilters} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700">
                Сбросить поиск и статус
              </button>
            ) : undefined}
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {visibleStudents.map((student) => (
                <article
                  key={`mobile-${student.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {student.fullName}
                      <span className="block text-xs font-normal text-slate-600">{student.courseTitle}</span>
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {student.status === "pending" ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                          Ожидает
                        </span>
                      ) : null}
                      <button
                        type="button"
                        aria-expanded={Boolean(mobileDataOpenById[student.id])}
                        aria-label={`Контактные данные: ${student.fullName}, ${student.courseTitle}`}
                        onClick={() => {
                          setMobileDataOpenById((prev) => ({
                            ...prev,
                            [student.id]: !prev[student.id],
                          }));
                        }}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {mobileDataOpenById[student.id] ? "Скрыть" : "Данные"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    {mobileDataOpenById[student.id] ? (
                      <div className="mt-2 space-y-2 text-xs text-slate-700">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Почта
                          </p>
                          <p className="break-all">
                            {student.email || "Не указана"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">
                            Телефон
                          </p>
                          <p>{student.phone || "Телефон не указан"}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    {student.status === "pending" ? (
                      <>
                        <p className="mb-2 rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                          Запрос:{" "}
                          {student.requestCourseTitle ?? student.courseId}
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={Boolean(busyRequestId)}
                            onClick={() => {
                              if (!student.requestId) return;
                              void reviewRequest(student.requestId, "approved");
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {busyRequestId === student.requestId
                              ? "Обработка..."
                              : "Одобрить"}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={Boolean(busyRequestId)}
                            onClick={() => {
                              if (!student.requestId) return;
                              void reviewRequest(student.requestId, "rejected");
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                            {busyRequestId === student.requestId
                              ? "Обработка..."
                              : "Отказать"}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <div className="mobile-scroll hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">ФИО</th>
                    <th className="py-2 pr-3 font-medium">
                      Электронная почта и номер телефона
                    </th>
                    <th className="py-2 pr-3 font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-medium">
                        {student.fullName}
                        <p className="text-xs font-normal text-slate-600">{student.courseTitle}</p>
                      </td>
                      <td className="py-3 pr-3">
                        {student.email ? (
                          <p className="break-all text-sm text-slate-700">
                            {student.email}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-slate-600">
                          {student.phone || "Телефон не указан"}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        {student.status === "pending" ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                              Запрос:{" "}
                              {student.requestCourseTitle ?? student.courseId}
                            </span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={Boolean(busyRequestId)}
                              onClick={() => {
                                if (!student.requestId) return;
                                void reviewRequest(
                                  student.requestId,
                                  "approved",
                                );
                              }}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {busyRequestId === student.requestId
                                ? "..."
                                : "Одобрить"}
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={Boolean(busyRequestId)}
                              onClick={() => {
                                if (!student.requestId) return;
                                void reviewRequest(
                                  student.requestId,
                                  "rejected",
                                );
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              {busyRequestId === student.requestId
                                ? "..."
                                : "Отказать"}
                            </button>
                          </div>
                        ) : (
                          <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            Доступ одобрен
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
