"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type CourseItem = {
  id: string;
  title: string;
  teacherId: string;
  isPublished: boolean;
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
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [enrollmentByCourse, setEnrollmentByCourse] = useState<ReportItem[]>(
    [],
  );
  const [error, setError] = useState("");
  const [deleteCourseId, setDeleteCourseId] = useState("");
  const [deleteCourseTitle, setDeleteCourseTitle] = useState("");
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  const loadData = async () => {
    try {
      const [coursesRes, usersRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/api/courses`, {
          credentials: "include",
        }),
        fetch(`${API_URL}/api/admin/users`, {
          credentials: "include",
        }),
        fetch(`${API_URL}/api/admin/reports`, {
          credentials: "include",
        }),
      ]);

      const coursesData = (await coursesRes.json()) as {
        courses?: CourseItem[];
        message?: string;
      };
      const usersData = (await usersRes.json()) as {
        users?: TeacherItem[];
        message?: string;
      };
      const reportsData = (await reportsRes.json()) as {
        enrollmentByCourse?: ReportItem[];
        message?: string;
      };

      if (!coursesRes.ok || !usersRes.ok || !reportsRes.ok) {
        setError(
          coursesData.message ??
            usersData.message ??
            reportsData.message ??
            "Не удалось загрузить список курсов",
        );
        return;
      }

      setCourses(coursesData.courses ?? []);
      setTeachers(
        (usersData.users ?? []).filter((item) => item.role === "teacher"),
      );
      setEnrollmentByCourse(reportsData.enrollmentByCourse ?? []);
    } catch {
      setError("Ошибка сети");
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

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
      const response = await fetch(
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
      await loadData();
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsDeletingCourse(false);
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

  const enrollmentsByCourse = useMemo(
    () =>
      enrollmentByCourse.reduce<Record<string, number>>((acc, item) => {
        acc[item.courseId] = item.students;
        return acc;
      }, {}),
    [enrollmentByCourse],
  );

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

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mobile-scroll mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-3 font-medium">Название курса</th>
              <th className="py-2 pr-3 font-medium">Преподаватель</th>
              <th className="py-2 pr-3 font-medium">Количество студентов</th>
              <th className="py-2 pr-3 font-medium">Статус</th>
              <th className="py-2 pr-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((course) => (
              <tr key={course.id} className="border-b border-slate-100">
                <td className="py-3 pr-3">{course.title}</td>
                <td className="py-3 pr-3">
                  {teacherById[course.teacherId] ?? course.teacherId}
                </td>
                <td className="py-3 pr-3">
                  {enrollmentsByCourse[course.id] ?? 0}
                </td>
                <td className="py-3 pr-3">
                  {course.isPublished ? "Активный" : "Скрытый"}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/dashboard/admin/courses/${course.id}/students`}
                      className="text-blue-700 hover:underline"
                    >
                      Студенты курса
                    </Link>
                    <Link
                      href={`/dashboard/admin/courses/${course.id}/teacher`}
                      className="text-blue-700 hover:underline"
                    >
                      Назначить преподавателя
                    </Link>
                    <button
                      type="button"
                      className="text-rose-600 hover:underline"
                      onClick={() => openDeleteModal(course.id, course.title)}
                    >
                      Удалить курс
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </main>
  );
}
