"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  const [students, setStudents] = useState<CourseStudentCard[]>([]);
  const [error, setError] = useState("");
  const [busyRequestId, setBusyRequestId] = useState("");
  const [mobileDataOpenById, setMobileDataOpenById] = useState<
    Record<string, boolean>
  >({});

  const loadStudents = async () => {
    setError("");

    if (!API_URL) {
      setError("Не задан NEXT_PUBLIC_API_URL");
      setStudents([]);
      return;
    }

    try {
      const [coursesResponse, requestsResponse] = await Promise.all([
        fetch(`${API_URL}/api/teacher/courses`, { credentials: "include" }),
        fetch(`${API_URL}/api/teacher/course-access-requests?status=pending`, {
          credentials: "include",
        }),
      ]);

      if (!coursesResponse.ok) {
        setError("Не удалось загрузить список курсов");
        setStudents([]);
        return;
      }

      const coursesPayload = (await coursesResponse.json()) as {
        courses?: TeacherCourseItem[];
      };
      const courses = coursesPayload.courses ?? [];

      const requestPayload = requestsResponse.ok
        ? ((await requestsResponse.json()) as { requests?: AccessRequest[] })
        : { requests: [] as AccessRequest[] };
      const pendingRequests = (requestPayload.requests ?? []).filter(
        (request) => request.status === "pending",
      );

      const detailsResponses = await Promise.all(
        courses.map(async (course) => {
          const detailsResponse = await fetch(
            `${API_URL}/api/teacher/courses/${course.id}/details`,
            { credentials: "include" },
          );

          if (!detailsResponse.ok) {
            return null;
          }

          const detailsPayload =
            (await detailsResponse.json()) as TeacherCourseDetails;
          return {
            course,
            students: detailsPayload.students ?? [],
          };
        }),
      );

      const mapByStudentId = new Map<string, CourseStudentCard>();

      detailsResponses.forEach((entry) => {
        if (!entry) return;

        (entry.students ?? []).forEach((student) => {
          mapByStudentId.set(student.id, {
            id: `${entry.course.id}-${student.id}`,
            studentId: student.id,
            fullName: student.fullName,
            email: student.email,
            phone: student.phone ?? "",
            courseId: entry.course.id,
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

        const current = mapByStudentId.get(request.student.id);
        mapByStudentId.set(request.student.id, {
          id: current?.id ?? `pending-${request.id}`,
          studentId: request.student.id,
          fullName: request.student.fullName,
          email: request.student.email,
          phone: current?.phone ?? "",
          courseId: request.courseId,
          requestId: request.id,
          requestCourseTitle: request.course?.title,
          status: "pending",
        });
      });

      const sortedStudents = Array.from(mapByStudentId.values()).sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "ru-RU", { sensitivity: "base" }),
      );

      setStudents(sortedStudents);
    } catch {
      setError("Ошибка сети при загрузке студентов");
      setStudents([]);
    }
  };

  const reviewRequest = async (
    requestId: string,
    status: "approved" | "rejected",
  ) => {
    if (!API_URL) {
      setError("Не задан NEXT_PUBLIC_API_URL");
      return;
    }

    setBusyRequestId(requestId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/course-access-requests/${requestId}`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось обработать заявку");
        return;
      }

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
    } catch {
      setError("Ошибка сети при обработке заявки");
    } finally {
      setBusyRequestId("");
    }
  };

  useEffect(() => {
    void loadStudents();
  }, []);

  return (
    <main className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Студенты</h1>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          Все студенты ({students.length})
        </h2>

        {students.length === 0 ? (
          <p className="text-sm text-slate-600">Студентов пока нет.</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {students.map((student) => (
                <article
                  key={`mobile-${student.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-words text-sm font-semibold text-slate-900">
                      {student.fullName}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {student.status === "pending" ? (
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                          Ожидает
                        </span>
                      ) : null}
                      <button
                        type="button"
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
                            disabled={busyRequestId === student.requestId}
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
                            disabled={busyRequestId === student.requestId}
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
                  {students.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 font-medium">
                        {student.fullName}
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
                              disabled={busyRequestId === student.requestId}
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
                              disabled={busyRequestId === student.requestId}
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
