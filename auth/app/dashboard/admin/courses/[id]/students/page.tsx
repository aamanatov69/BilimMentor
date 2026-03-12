"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseStudentItem = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isEnrolled: boolean;
  approvedAt: string | null;
};

type CourseStudentsResponse = {
  course?: { id: string; title: string };
  students?: CourseStudentItem[];
  message?: string;
};

export default function AdminCourseStudentsPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const [courseTitle, setCourseTitle] = useState("");
  const [students, setStudents] = useState<CourseStudentItem[]>([]);
  const [busyStudentId, setBusyStudentId] = useState("");
  const [error, setError] = useState("");

  const loadStudents = async () => {

    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${id}/students`, {
          credentials: "include",
        },
      );

      const data = (await response.json()) as CourseStudentsResponse;
      if (!response.ok) {
        setError(data.message ?? "Не удалось загрузить студентов курса");
        return;
      }

      setCourseTitle(data.course?.title ?? id);
      setStudents(data.students ?? []);
    } catch {
      setError("Ошибка сети");
    }
  };

  useEffect(() => {
    if (id) {
      void loadStudents();
    }
  }, [id]);

  const toggleEnrollment = async (studentId: string, enrolled: boolean) => {

    setBusyStudentId(studentId);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/admin/courses/${id}/students/${studentId}`, {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enrolled }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось обновить доступ к курсу");
        return;
      }

      await loadStudents();
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusyStudentId("");
    }
  };

  const sortedStudents = useMemo(
    () =>
      [...students].sort((a, b) =>
        a.fullName.localeCompare(b.fullName, "ru-RU", {
          sensitivity: "base",
        }),
      ),
    [students],
  );

  return (
    <main className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">
            Студенты курса: {courseTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Администратор может подключить студента к курсу или убрать его.
          </p>
        </div>
        <Link
          href="/dashboard/admin/courses"
          className="text-sm text-blue-700 hover:underline"
        >
          К списку курсов
        </Link>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="mobile-scroll overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">ФИО</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Телефон</th>
              <th className="py-2 pr-3 font-medium">Статус в курсе</th>
              <th className="py-2 pr-3 font-medium">Действие</th>
            </tr>
          </thead>
          <tbody>
            {sortedStudents.map((student) => (
              <tr key={student.id} className="border-b border-slate-100">
                <td className="py-3 pr-3 font-medium">{student.fullName}</td>
                <td className="py-3 pr-3">{student.email}</td>
                <td className="py-3 pr-3">{student.phone}</td>
                <td className="py-3 pr-3">
                  {student.isEnrolled ? (
                    <span className="text-emerald-700">
                      Подключен
                      {student.approvedAt
                        ? ` (${new Date(student.approvedAt).toLocaleDateString()})`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-slate-600">Не подключен</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {student.isEnrolled ? (
                    <button
                      type="button"
                      className="text-rose-700 hover:underline"
                      disabled={busyStudentId === student.id}
                      onClick={() => void toggleEnrollment(student.id, false)}
                    >
                      Убрать из курса
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-blue-700 hover:underline"
                      disabled={busyStudentId === student.id}
                      onClick={() => void toggleEnrollment(student.id, true)}
                    >
                      Подключить к курсу
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
