"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type GradeRow = {
  submissionId: string;
  studentId: string;
  courseId: string;
  studentEmail?: string;
  studentName: string;
  assignmentTitle: string;
  courseTitle: string;
  score: string | number | null;
  feedback: string | null;
  submittedAt: string;
};

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function TeacherGradesPage() {
  const searchParams = useSearchParams();
  const targetSubmissionId = searchParams.get("submissionId") ?? "";

  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [error, setError] = useState("");
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [modalStudentId, setModalStudentId] = useState<string | null>(null);
  const [modalGradeFilter, setModalGradeFilter] = useState<
    "ungraded" | "graded"
  >("ungraded");
  const [commentModalRow, setCommentModalRow] = useState<GradeRow | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");

  useEffect(() => {
    const loadGrades = async () => {
      const token = getTokenFromCookie();
      if (!token) {
        setError("Требуется авторизация");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/teacher/grades`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = (await response.json()) as {
          rows?: GradeRow[];
          message?: string;
        };

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить оценки");
          return;
        }

        setGradeRows(data.rows ?? []);
        setScoreDrafts(
          Object.fromEntries(
            (data.rows ?? []).map((row) => [
              row.submissionId,
              row.score === null || typeof row.score === "undefined"
                ? ""
                : String(row.score),
            ]),
          ),
        );
      } catch {
        setError("Ошибка сети");
      }
    };

    void loadGrades();
  }, []);

  useEffect(() => {
    if (!targetSubmissionId) {
      return;
    }

    const timer = setTimeout(() => {
      const target = document.getElementById(
        `submission-${targetSubmissionId}`,
      );
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [targetSubmissionId, gradeRows.length]);

  const saveGrade = async (row: GradeRow) => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    const rawValue = scoreDrafts[row.submissionId] ?? "";
    const score = Number(rawValue);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Оценка должна быть числом от 0 до 100");
      return;
    }

    setError("");
    setSavedIds((prev) => ({ ...prev, [row.submissionId]: false }));
    setSavingIds((prev) => ({ ...prev, [row.submissionId]: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/submissions/${row.submissionId}/grade`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            score,
            feedback: row.feedback ?? "",
          }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        grade?: { score?: number | string | null; feedback?: string | null };
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось сохранить оценку");
        return;
      }

      setGradeRows((prev) =>
        prev.map((item) =>
          item.submissionId === row.submissionId
            ? {
                ...item,
                score:
                  typeof data.grade?.score !== "undefined"
                    ? (data.grade?.score ?? score)
                    : score,
                feedback:
                  typeof data.grade?.feedback !== "undefined"
                    ? data.grade?.feedback
                    : item.feedback,
              }
            : item,
        ),
      );
      setScoreDrafts((prev) => ({
        ...prev,
        [row.submissionId]: String(score),
      }));
      setSavedIds((prev) => ({ ...prev, [row.submissionId]: true }));
    } catch {
      setError("Ошибка сети");
    } finally {
      setSavingIds((prev) => ({ ...prev, [row.submissionId]: false }));
    }
  };

  const saveComment = async () => {
    if (!commentModalRow) {
      return;
    }

    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    setError("");
    setCommentMessage("");
    setCommentSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/submissions/${commentModalRow.submissionId}/comment`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment: commentDraft }),
        },
      );

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Не удалось сохранить комментарий");
        return;
      }

      setGradeRows((prev) =>
        prev.map((item) =>
          item.submissionId === commentModalRow.submissionId
            ? { ...item, feedback: commentDraft }
            : item,
        ),
      );
      setCommentMessage(data.message ?? "Комментарий сохранен");
      setCommentModalRow(null);
      setCommentDraft("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setCommentSaving(false);
    }
  };

  const groupedByStudent = useMemo(() => {
    const map = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        studentEmail: string;
        rows: GradeRow[];
      }
    >();

    for (const row of gradeRows) {
      const existing = map.get(row.studentId);
      if (existing) {
        existing.rows.push(row);
      } else {
        map.set(row.studentId, {
          studentId: row.studentId,
          studentName: row.studentName,
          studentEmail: row.studentEmail ?? "",
          rows: [row],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName, "ru-RU", {
        sensitivity: "base",
      }),
    );
  }, [gradeRows]);

  const modalStudent = useMemo(() => {
    if (!modalStudentId) {
      return null;
    }

    return (
      groupedByStudent.find((item) => item.studentId === modalStudentId) ?? null
    );
  }, [groupedByStudent, modalStudentId]);

  const modalFilteredRows = useMemo(() => {
    if (!modalStudent) {
      return [];
    }

    if (modalGradeFilter === "graded") {
      return modalStudent.rows.filter(
        (row) => row.score !== null && typeof row.score !== "undefined",
      );
    }

    return modalStudent.rows.filter(
      (row) => row.score === null || typeof row.score === "undefined",
    );
  }, [modalStudent, modalGradeFilter]);

  useEffect(() => {
    if (!targetSubmissionId || gradeRows.length === 0) {
      return;
    }

    const targetRow = gradeRows.find(
      (item) => item.submissionId === targetSubmissionId,
    );

    if (!targetRow) {
      return;
    }

    setModalStudentId(targetRow.studentId);
  }, [targetSubmissionId, gradeRows]);

  useEffect(() => {
    if (modalStudentId) {
      setModalGradeFilter("ungraded");
    }
  }, [modalStudentId]);

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Оценки</h1>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link
            href="/dashboard/teacher/students"
            className="rounded bg-blue-700 px-3 py-2 text-sm text-white hover:bg-blue-800"
          >
            Заявки студентов
          </Link>
        </div>
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h2 className="text-sm font-semibold text-slate-800">
          Список студентов
        </h2>
        {groupedByStudent.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {groupedByStudent.map((item) => (
              <span
                key={item.studentId}
                className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700"
              >
                {item.studentName}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Студенты пока не отображаются: нет сдач для оценивания.
          </p>
        )}
      </section>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 space-y-4">
        {groupedByStudent.length === 0 ? (
          <p className="text-sm text-slate-600">Сдач пока нет.</p>
        ) : (
          groupedByStudent.map((student) => (
            <article
              key={student.studentId}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div>
                  <h2 className="font-semibold">{student.studentName}</h2>
                  {student.studentEmail ? (
                    <p className="text-xs text-slate-500">
                      {student.studentEmail}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setModalStudentId(student.studentId)}
                  className="justify-self-start rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50 sm:justify-self-center"
                >
                  Задания
                </button>
                <p className="text-xs text-slate-500 sm:justify-self-end">
                  Заданий: {student.rows.length}
                </p>
              </div>
            </article>
          ))
        )}
      </div>

      {modalStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Задания студента</h2>
                <p className="text-sm text-slate-600">
                  {modalStudent.studentName}
                </p>
                {modalStudent.studentEmail ? (
                  <p className="text-xs text-slate-500">
                    {modalStudent.studentEmail}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setModalStudentId(null)}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setModalGradeFilter("ungraded")}
                className={
                  modalGradeFilter === "ungraded"
                    ? "rounded-full border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                Не выставленные (
                {
                  modalStudent.rows.filter(
                    (row) =>
                      row.score === null || typeof row.score === "undefined",
                  ).length
                }
                )
              </button>
              <button
                type="button"
                onClick={() => setModalGradeFilter("graded")}
                className={
                  modalGradeFilter === "graded"
                    ? "rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                    : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                Выставленные (
                {
                  modalStudent.rows.filter(
                    (row) =>
                      row.score !== null && typeof row.score !== "undefined",
                  ).length
                }
                )
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {modalFilteredRows.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {modalGradeFilter === "graded"
                    ? "Нет заданий с выставленной оценкой."
                    : "Нет заданий без выставленной оценки."}
                </p>
              ) : (
                modalFilteredRows.map((row, index) => (
                  <div
                    id={`submission-${row.submissionId}`}
                    key={row.submissionId}
                    className={
                      targetSubmissionId === row.submissionId
                        ? "rounded border border-blue-300 bg-blue-50 p-3"
                        : "rounded border border-slate-200 p-3"
                    }
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      Пункт {index + 1}
                    </p>
                    <p className="font-medium">{row.assignmentTitle}</p>
                    <p className="text-xs text-slate-500">
                      Курс: {row.courseTitle}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(row.submittedAt).toLocaleString()}
                    </p>

                    <div className="mt-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                      <label className="text-xs text-slate-600">Оценка:</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreDrafts[row.submissionId] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [row.submissionId]: value,
                          }));
                          setSavedIds((prev) => ({
                            ...prev,
                            [row.submissionId]: false,
                          }));
                        }}
                        onBlur={() => void saveGrade(row)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void saveGrade(row);
                          }
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm sm:w-24"
                        placeholder="0-100"
                      />
                      <button
                        type="button"
                        onClick={() => void saveGrade(row)}
                        disabled={!!savingIds[row.submissionId]}
                        className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
                      >
                        {savingIds[row.submissionId]
                          ? "Сохранение..."
                          : "Оценить"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCommentModalRow(row);
                          setCommentDraft(row.feedback ?? "");
                          setCommentMessage("");
                        }}
                        className="text-sm text-blue-700 hover:underline"
                      >
                        Комментарий
                      </button>
                      {savedIds[row.submissionId] ? (
                        <span className="text-xs text-emerald-700">
                          Сохранено
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-slate-600">
                      Текущий комментарий: {row.feedback ?? "-"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {commentModalRow ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Комментарий к заданию</h2>
                <p className="text-sm text-slate-600">
                  {commentModalRow.assignmentTitle}
                </p>
                <p className="text-xs text-slate-500">
                  Студент: {commentModalRow.studentName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCommentModalRow(null);
                  setCommentMessage("");
                }}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            <textarea
              className="mt-4 min-h-32 w-full rounded border border-slate-300 px-3 py-2"
              placeholder="Напишите комментарий"
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
            />

            {commentMessage ? (
              <p className="mt-2 text-sm text-emerald-700">{commentMessage}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveComment()}
                disabled={commentSaving}
                className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {commentSaving ? "Сохранение..." : "Сохранить комментарий"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCommentModalRow(null);
                  setCommentMessage("");
                }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
