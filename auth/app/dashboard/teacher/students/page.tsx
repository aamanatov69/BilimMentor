"use client";

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

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState<CourseStudentCard[]>([]);
  const [error, setError] = useState("");
  const [busyRequestId, setBusyRequestId] = useState("");

  const loadStudents = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setError("");

    try {
      const [coursesRes, pendingRes] = await Promise.all([
        fetch(`${API_URL}/api/teacher/courses`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/teacher/course-access-requests?status=pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const coursesData = (await coursesRes.json()) as {
        courses?: TeacherCourseItem[];
        message?: string;
      };
      const pendingData = (await pendingRes.json()) as {
        requests?: AccessRequest[];
        message?: string;
      };

      if (!coursesRes.ok || !pendingRes.ok) {
        setError(
          coursesData.message ??
            pendingData.message ??
            "Не удалось загрузить студентов",
        );
        return;
      }

      const courseList = coursesData.courses ?? [];
      const detailResponses = await Promise.all(
        courseList.map(async (course) => {
          const response = await fetch(
            `${API_URL}/api/teacher/courses/${course.id}/details`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (!response.ok) {
            return null;
          }

          const data = (await response.json()) as TeacherCourseDetails;
          return {
            courseId: course.id,
            students: data.students ?? [],
          };
        }),
      );

      const nextStudents: CourseStudentCard[] = detailResponses
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .flatMap((item) =>
          item.students.map((student) => ({
            id: `${item.courseId}-${student.id}`,
            studentId: student.id,
            fullName: student.fullName,
            email: student.email,
            phone: student.phone ?? "",
            courseId: item.courseId,
            status: "approved" as const,
          })),
        );

      const mapByStudentId = nextStudents.reduce<
        Map<string, CourseStudentCard>
      >((acc, student) => {
        if (!acc.has(student.studentId)) {
          acc.set(student.studentId, student);
        }
        return acc;
      }, new Map());

      (pendingData.requests ?? []).forEach((request) => {
        if (request.status !== "pending" || !request.student?.id) {
          return;
        }

        const current = mapByStudentId.get(request.student.id);
        const pendingEntry: CourseStudentCard = {
          id: current?.id ?? `pending-${request.id}`,
          studentId: request.student.id,
          fullName: request.student.fullName,
          email: request.student.email,
          phone: current?.phone ?? "",
          courseId: request.courseId,
          requestId: request.id,
          requestCourseTitle: request.course?.title,
          status: "pending",
        };

        mapByStudentId.set(request.student.id, pendingEntry);
      });

      const uniqueStudents = Array.from(mapByStudentId.values());

      const sortedStudents = [...uniqueStudents].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "ru-RU", {
          sensitivity: "base",
        }),
      );

      setStudents(sortedStudents);
    } catch {
      setError("Ошибка сети при загрузке студентов");
    }
  };

  const reviewRequest = async (
    requestId: string,
    status: "approved" | "rejected",
  ) => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setBusyRequestId(requestId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/course-access-requests/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось обработать заявку");
        return;
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
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-xl font-semibold sm:text-2xl">Студенты</h1>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {students.length === 0 ? (
          <p className="text-sm text-slate-600">Студентов пока нет.</p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {students.map((student) => (
                <article
                  key={`mobile-${student.id}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="break-words font-medium text-slate-900">
                    {student.fullName}
                  </p>
                  <p className="mt-1 break-all text-sm text-slate-700">
                    {student.email}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {student.phone || "Телефон не указан"}
                  </p>

                  <div className="mt-3 space-y-2">
                    {student.status === "pending" ? (
                      <>
                        <span className="block text-xs text-amber-700">
                          Запрос на курс:{" "}
                          {student.requestCourseTitle ?? student.courseId}
                        </span>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700"
                            disabled={busyRequestId === student.requestId}
                            onClick={() => {
                              if (!student.requestId) return;
                              void reviewRequest(student.requestId, "approved");
                            }}
                          >
                            Одобрить
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
                            disabled={busyRequestId === student.requestId}
                            onClick={() => {
                              if (!student.requestId) return;
                              void reviewRequest(student.requestId, "rejected");
                            }}
                          >
                            Отказать
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-emerald-700">
                        Доступ одобрен
                      </span>
                    )}
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
                        <p className="break-all text-slate-700">
                          {student.email}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {student.phone || "Телефон не указан"}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex flex-wrap items-center gap-3">
                          {student.status === "pending" ? (
                            <>
                              <span className="text-xs text-amber-700">
                                Запрос на курс:{" "}
                                {student.requestCourseTitle ?? student.courseId}
                              </span>
                              <button
                                type="button"
                                className="text-xs text-emerald-700 hover:underline"
                                disabled={busyRequestId === student.requestId}
                                onClick={() => {
                                  if (!student.requestId) return;
                                  void reviewRequest(
                                    student.requestId,
                                    "approved",
                                  );
                                }}
                              >
                                Одобрить
                              </button>
                              <button
                                type="button"
                                className="text-xs text-rose-700 hover:underline"
                                disabled={busyRequestId === student.requestId}
                                onClick={() => {
                                  if (!student.requestId) return;
                                  void reviewRequest(
                                    student.requestId,
                                    "rejected",
                                  );
                                }}
                              >
                                Отказать
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-emerald-700">
                              Доступ одобрен
                            </span>
                          )}
                        </div>
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
