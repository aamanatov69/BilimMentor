"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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

export default function TeacherGradesPage() {
  const searchParams = useSearchParams();
  const targetSubmissionId = searchParams.get("submissionId") ?? "";

  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const saveNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gradeFilter, setGradeFilter] = useState<"ungraded" | "graded">(
    "ungraded",
  );
  const [commentModalRow, setCommentModalRow] = useState<GradeRow | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");

  useEffect(() => {
    const loadGrades = async () => {
      try {
        const response = await fetch(`${API_URL}/api/teacher/grades`, {
          credentials: "include",
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
    const rawValue = scoreDrafts[row.submissionId] ?? "";
    const score = Number(rawValue);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Оценка должна быть числом от 0 до 100");
      return;
    }

    setError("");
    setSavingIds((prev) => ({ ...prev, [row.submissionId]: true }));

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/submissions/${row.submissionId}/grade`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
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
      setSaveNotice("Сохранено");
      if (saveNoticeTimerRef.current) {
        clearTimeout(saveNoticeTimerRef.current);
      }
      saveNoticeTimerRef.current = setTimeout(() => {
        setSaveNotice("");
      }, 1700);
      window.dispatchEvent(new Event("teacher-grades-updated"));
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

    setError("");
    setCommentMessage("");
    setCommentSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/api/teacher/submissions/${commentModalRow.submissionId}/comment`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
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

  const isRowGraded = (row: GradeRow) =>
    row.score !== null && typeof row.score !== "undefined";

  const filterRowsByGrade = (rows: GradeRow[]) =>
    rows.filter((row) =>
      gradeFilter === "graded" ? isRowGraded(row) : !isRowGraded(row),
    );

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
  }, [targetSubmissionId, gradeRows]);

  useEffect(
    () => () => {
      if (saveNoticeTimerRef.current) {
        clearTimeout(saveNoticeTimerRef.current);
      }
    },
    [],
  );

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Оценки</h1>
        {/* <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Link
            href="/dashboard/teacher/students"
            className="rounded bg-blue-700 px-3 py-2 text-sm text-white hover:bg-blue-800"
          >
            Заявки студентов
          </Link>
        </div> */}
      </div>

      <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGradeFilter("ungraded")}
            className={
              gradeFilter === "ungraded"
                ? "rounded-full border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            Не выставленные (
            {
              gradeRows.filter(
                (row) => row.score === null || typeof row.score === "undefined",
              ).length
            }
            )
          </button>
          <button
            type="button"
            onClick={() => setGradeFilter("graded")}
            className={
              gradeFilter === "graded"
                ? "rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            Выставленные (
            {
              gradeRows.filter(
                (row) => row.score !== null && typeof row.score !== "undefined",
              ).length
            }
            )
          </button>
        </div>
      </section>

      {saveNotice ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4">
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 shadow">
            {saveNotice}
          </p>
        </div>
      ) : null}

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
              <div className="space-y-3">
                {filterRowsByGrade(student.rows).map((row) => (
                  <div
                    id={`submission-${row.submissionId}`}
                    key={row.submissionId}
                    className={
                      targetSubmissionId === row.submissionId
                        ? "rounded border border-blue-300 bg-blue-50 p-3"
                        : "rounded border border-slate-200 p-3"
                    }
                  >
                    <div className="md:hidden">
                      <p className="text-sm font-semibold">
                        {student.studentName}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/teacher/assignments?submissionId=${row.submissionId}`}
                          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                        >
                          Просмотреть
                        </Link>
                        <label className="text-xs text-slate-600">
                          Оценка:
                        </label>
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
                          }}
                          onBlur={() => void saveGrade(row)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveGrade(row);
                            }
                          }}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                          placeholder="0-100"
                        />
                        <button
                          type="button"
                          onClick={() => void saveGrade(row)}
                          disabled={!!savingIds[row.submissionId]}
                          className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
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
                      </div>
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <div className="flex min-w-[760px] items-center gap-3 whitespace-nowrap">
                        <p className="min-w-[180px] font-semibold">
                          {student.studentName}
                        </p>
                        <div className="ml-auto flex items-center gap-3">
                          <Link
                            href={`/dashboard/teacher/assignments?submissionId=${row.submissionId}`}
                            className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Просмотреть
                          </Link>
                          <label className="text-xs text-slate-600">
                            Оценка:
                          </label>
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
                            }}
                            onBlur={() => void saveGrade(row)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveGrade(row);
                              }
                            }}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                            placeholder="0-100"
                          />
                          <button
                            type="button"
                            onClick={() => void saveGrade(row)}
                            disabled={!!savingIds[row.submissionId]}
                            className="rounded bg-blue-700 px-3 py-1 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
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
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filterRowsByGrade(student.rows).length === 0 ? (
                  <p className="text-sm text-slate-600">
                    {gradeFilter === "graded"
                      ? "Нет заданий с выставленной оценкой."
                      : "Нет заданий без выставленной оценки."}
                  </p>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      {commentModalRow ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Комментарий к заданию</h2>
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
