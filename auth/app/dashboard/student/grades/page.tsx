"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { useEffect, useState } from "react";

import { LoadError } from "@/components/ui/load-error";
import { apiJson, apiErrorMessage } from "@/lib/api-client";

type StudentGradesOverview = {
  summary: {
    assignmentsSubmitted: number;
    assignmentsGraded: number;
    averageScore: number | null;
    bestScore: number | null;
    worstScore: number | null;
  };
  courseStats: {
    courseId: string;
    courseTitle: string;
    teacherName: string;
    assignmentsSubmitted: number;
    assignmentsGraded: number;
    averageScore: number | null;
    maxScore: number | null;
    minScore: number | null;
  }[];
  assignmentGrades: {
    submissionId: string;
    assignmentId: string;
    assignmentTitle: string;
    courseId: string;
    courseTitle: string;
    teacherName: string;
    score: number | null;
    feedback: string | null;
    submittedAt: string;
    gradedAt: string | null;
  }[];
};

export default function StudentGradesPage() {
  const [overview, setOverview] = useState<StudentGradesOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson<StudentGradesOverview>("/api/student/grades", { signal: controller.signal });
        if (!controller.signal.aborted) setOverview(data);
      } catch (error) {
        if (!controller.signal.aborted) setError(apiErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void loadData();
    return () => controller.abort();
  }, [retry]);

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <PageHeader title="Оценки и статистика" description="Оценки по заданиям и общая статистика по каждому курсу." />
      </section>

      {loading ? (
        <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Загрузка оценок и статистики…</div>
      ) : error ? (
        <LoadError message={error} onRetry={() => setRetry((value) => value + 1)} />
      ) : overview ? (
      <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Сдано заданий</p>
          <p className="mt-2 text-3xl font-semibold text-blue-700">
            {overview?.summary.assignmentsSubmitted ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Оценено</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-700">
            {overview?.summary.assignmentsGraded ?? 0}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Средний балл</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">
            {overview?.summary.averageScore ?? "-"}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Лучший / худший балл</p>
          <p className="mt-2 text-xl font-semibold text-slate-800">
            {(overview?.summary.bestScore ?? "-") +
              " / " +
              (overview?.summary.worstScore ?? "-")}
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Статистика по курсам</h2>
        {(overview?.courseStats ?? []).length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-600">
              Пока нет данных по курсам. Сдайте первую работу, чтобы статистика
              начала заполняться.
            </p>
            <Link
              href="/dashboard/student/assignments"
              className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Перейти к заданиям
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3 md:hidden">
              {(overview?.courseStats ?? []).map((row) => (
                <article
                  key={`mobile-${row.courseId}`}
                  className="rounded-lg border border-slate-200 p-3"
                >
                  <p className="font-medium text-slate-900">
                    {row.courseTitle}
                  </p>
                  <p className="text-xs text-slate-500">{row.teacherName}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <p>Сдано: {row.assignmentsSubmitted}</p>
                    <p>Оценено: {row.assignmentsGraded}</p>
                    <p>Средний: {row.averageScore ?? "-"}</p>
                    <p>
                      Макс/Мин: {row.maxScore ?? "-"}/{row.minScore ?? "-"}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="mobile-scroll mt-4 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">Курс</th>
                    <th className="py-2 pr-3 font-medium">Преподаватель</th>
                    <th className="py-2 pr-3 font-medium">Сдано</th>
                    <th className="py-2 pr-3 font-medium">Оценено</th>
                    <th className="py-2 pr-3 font-medium">Средний балл</th>
                    <th className="py-2 pr-3 font-medium">Макс</th>
                    <th className="py-2 pr-3 font-medium">Мин</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.courseStats ?? []).map((row) => (
                    <tr
                      key={row.courseId}
                      className="border-b border-slate-100"
                    >
                      <td className="py-3 pr-3">{row.courseTitle}</td>
                      <td className="py-3 pr-3">{row.teacherName}</td>
                      <td className="py-3 pr-3">{row.assignmentsSubmitted}</td>
                      <td className="py-3 pr-3">{row.assignmentsGraded}</td>
                      <td className="py-3 pr-3">{row.averageScore ?? "-"}</td>
                      <td className="py-3 pr-3">{row.maxScore ?? "-"}</td>
                      <td className="py-3 pr-3">{row.minScore ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold">Оценки по заданиям</h2>
        {(overview?.assignmentGrades ?? []).length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm text-slate-600">
              Результатов проверки пока нет. После проверки преподавателем здесь появятся оценки и комментарии.
            </p>
            <Link
              href="/dashboard/student/assignments"
              className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Открыть задания
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm">
            {(overview?.assignmentGrades ?? []).map((item) => (
              <article
                key={item.submissionId}
                className="rounded border border-slate-200 p-3"
              >
                <Link
                  href={`/dashboard/student/assignments#assignment-${encodeURIComponent(item.assignmentId)}`}
                  className="inline-flex min-h-11 items-center font-medium text-blue-700 underline underline-offset-4 hover:text-blue-900"
                >{item.assignmentTitle}</Link>
                <p className="break-words text-xs text-slate-500">
                  Курс: {item.courseTitle} • Преподаватель: {item.teacherName}
                </p>
                <p className="text-xs text-slate-700">
                  Оценка: {item.score ?? "Не оценено"}
                </p>
                <p className="break-words text-xs text-slate-600">
                  Комментарий: {item.feedback?.trim() || "Нет комментария"}
                </p>
                <p className="text-xs text-slate-500">
                  Сдано: {new Date(item.submittedAt).toLocaleString("ru-RU")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      </>
      ) : null}
    </main>
  );
}
