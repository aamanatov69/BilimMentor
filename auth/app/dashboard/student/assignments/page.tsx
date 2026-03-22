"use client";

import { useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type SubmissionAttachment = {
  name: string;
  type: string;
  size: number;
};

type AssignmentSubmission = {
  id: string;
  text: string;
  formula: string;
  code: string;
  attachments: SubmissionAttachment[];
  submittedAt: string;
  grade: number | null;
  feedback: string | null;
};

type StudentAssignment = {
  id: string;
  title: string;
  description: string | null;
  lessonTitle?: string | null;
  dueAt: string | null;
  course: {
    id: string;
    title: string;
    teacher: string;
  };
  submission: AssignmentSubmission | null;
};

type AttachmentDraft = SubmissionAttachment & {
  dataBase64: string;
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл"));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsDataURL(file);
  });
}

function isOverdueByDueAt(dueAt: string | null) {
  if (!dueAt) {
    return false;
  }

  const timestamp = new Date(dueAt).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() > timestamp;
}

export default function StudentAssignmentsPage() {
  const [activeFilter, setActiveFilter] = useState<
    "pending" | "completed" | "missed"
  >("pending");
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>(
    {},
  );
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [newAttachments, setNewAttachments] = useState<
    Record<string, AttachmentDraft[]>
  >({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const loadAssignments = async () => {
      try {
        const response = await fetch(`${API_URL}/api/student/assignments`, {
          credentials: "include",
        });

        const data = (await response.json()) as {
          assignments?: StudentAssignment[];
          message?: string;
        };

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить задания");
          return;
        }

        const rows = data.assignments ?? [];
        setAssignments(rows);
        setTextDrafts(
          Object.fromEntries(
            rows.map((item) => [item.id, item.submission?.text ?? ""]),
          ),
        );
        setFormulaDrafts(
          Object.fromEntries(
            rows.map((item) => [item.id, item.submission?.formula ?? ""]),
          ),
        );
        setCodeDrafts(
          Object.fromEntries(
            rows.map((item) => [item.id, item.submission?.code ?? ""]),
          ),
        );
      } catch {
        setError("Ошибка сети");
      }
    };

    void loadAssignments();
  }, []);

  const handleFilesSelected = async (
    assignmentId: string,
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) {
      return;
    }

    setError("");

    try {
      const mapped = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataBase64: await fileToBase64(file),
        })),
      );

      setNewAttachments((prev) => ({
        ...prev,
        [assignmentId]: [...(prev[assignmentId] ?? []), ...mapped],
      }));
    } catch {
      setError("Не удалось прочитать выбранные файлы");
    }
  };

  const submitAssignment = async (assignment: StudentAssignment) => {
    const text = (textDrafts[assignment.id] ?? "").trim();
    const formula = (formulaDrafts[assignment.id] ?? "").trim();
    const code = (codeDrafts[assignment.id] ?? "").trim();
    const attachments = newAttachments[assignment.id] ?? [];

    if (isOverdueByDueAt(assignment.dueAt)) {
      setError("Срок сдачи задания истек");
      return;
    }

    if (!text && !formula && !code && attachments.length === 0) {
      setError("Добавьте текст, формулу, код или хотя бы один файл");
      return;
    }

    setError("");
    setSuccess((prev) => ({ ...prev, [assignment.id]: "" }));
    setBusy((prev) => ({ ...prev, [assignment.id]: true }));

    try {
      const body: {
        content: string;
        formula: string;
        code: string;
        attachments?: AttachmentDraft[];
      } = {
        content: text,
        formula,
        code,
      };

      if (attachments.length > 0) {
        body.attachments = attachments;
      }

      const response = await fetch(
        `${API_URL}/api/student/assignments/${assignment.id}/submit`,
        {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        submission?: {
          id: string;
          text: string;
          formula: string;
          code: string;
          attachments: SubmissionAttachment[];
          submittedAt: string;
        };
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось отправить задание");
        return;
      }

      setAssignments((prev) =>
        prev.map((item) =>
          item.id === assignment.id
            ? {
                ...item,
                submission: {
                  id: data.submission?.id ?? item.submission?.id ?? "",
                  text,
                  formula,
                  code,
                  attachments:
                    data.submission?.attachments ??
                    item.submission?.attachments ??
                    [],
                  submittedAt:
                    data.submission?.submittedAt ?? new Date().toISOString(),
                  grade: item.submission?.grade ?? null,
                  feedback: item.submission?.feedback ?? null,
                },
              }
            : item,
        ),
      );
      setSelectedAssignmentId(null);

      setNewAttachments((prev) => ({ ...prev, [assignment.id]: [] }));
      setSuccess((prev) => ({
        ...prev,
        [assignment.id]: data.message ?? "Задание отправлено преподавателю",
      }));
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusy((prev) => ({ ...prev, [assignment.id]: false }));
    }
  };

  const pendingAssignments = useMemo(
    () =>
      assignments.filter(
        (item) => !item.submission && !isOverdueByDueAt(item.dueAt),
      ),
    [assignments],
  );

  const completedAssignments = useMemo(
    () => assignments.filter((item) => !!item.submission),
    [assignments],
  );

  const missedAssignments = useMemo(
    () =>
      assignments.filter(
        (item) => !item.submission && isOverdueByDueAt(item.dueAt),
      ),
    [assignments],
  );

  const filteredAssignments =
    activeFilter === "pending"
      ? pendingAssignments
      : activeFilter === "completed"
        ? completedAssignments
        : missedAssignments;

  const activeTitle =
    activeFilter === "pending"
      ? "Невыполненные задания"
      : activeFilter === "completed"
        ? "Выполненные задания"
        : "Пропущенные задания";

  const emptyStateText =
    activeFilter === "pending"
      ? "Нет невыполненных заданий."
      : activeFilter === "completed"
        ? "Пока нет выполненных заданий."
        : "Нет пропущенных заданий.";

  const selectedAssignment = useMemo(
    () =>
      assignments.find(
        (assignment) => assignment.id === selectedAssignmentId,
      ) ?? null,
    [assignments, selectedAssignmentId],
  );

  const renderAssignmentCard = (item: StudentAssignment) => (
    <article
      key={item.id}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {/** Form is intentionally hidden until user opens it for this assignment. */}
      {(() => {
        const isOverdue = isOverdueByDueAt(item.dueAt);
        const isBlockedByDeadline = !item.submission && isOverdue;

        return (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="break-words text-lg font-semibold">
                  {item.title}
                </h2>
                <p className="break-words text-sm text-slate-600">
                  Курс: {item.course.title}
                </p>
                <p className="break-words text-sm text-slate-600">
                  Урок: {item.lessonTitle?.trim() || "Не указан"}
                </p>
              </div>
              <div className="w-full text-xs text-slate-600 sm:w-auto sm:text-sm">
                Дедлайн:{" "}
                {item.dueAt
                  ? new Date(item.dueAt).toLocaleString()
                  : "Не указан"}
              </div>
            </div>

            {isBlockedByDeadline ? (
              <p className="mt-2 text-xs font-medium text-rose-700">
                Срок сдачи истек. Отправка недоступна.
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedAssignmentId(item.id)}
                className="w-full rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                Открыть задание
              </button>

              {item.submission ? (
                <span className="text-xs text-emerald-700">
                  Выполнено:{" "}
                  {new Date(item.submission.submittedAt).toLocaleString()}
                </span>
              ) : (
                <span
                  className={
                    isOverdueByDueAt(item.dueAt)
                      ? "text-xs text-rose-700"
                      : "text-xs text-amber-700"
                  }
                >
                  {isOverdueByDueAt(item.dueAt) ? "Пропущено" : "Не выполнено"}
                </span>
              )}

              {success[item.id] ? (
                <span className="text-xs text-emerald-700">
                  {success[item.id]}
                </span>
              ) : null}
            </div>

            {item.submission && item.submission.grade !== null ? (
              <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-medium text-emerald-800">
                  Оценка: {item.submission.grade}
                </p>
                <p className="text-emerald-900">
                  Комментарий: {item.submission.feedback ?? "-"}
                </p>
              </div>
            ) : null}
          </>
        );
      })()}
    </article>
  );

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h1 className="text-2xl font-semibold">Задания студента</h1>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter("pending")}
            className={
              activeFilter === "pending"
                ? "rounded-full border border-blue-700 bg-blue-700 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            Невыполненные задания ({pendingAssignments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("completed")}
            className={
              activeFilter === "completed"
                ? "rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            Выполненные задания ({completedAssignments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("missed")}
            className={
              activeFilter === "missed"
                ? "rounded-full border border-rose-700 bg-rose-700 px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            }
          >
            Пропущенные ({missedAssignments.length})
          </button>
        </div>

        <h2 className="text-lg font-semibold">{activeTitle}</h2>
        {filteredAssignments.length ? (
          <div
            className={
              filteredAssignments.length > 4
                ? "max-h-[42rem] space-y-3 overflow-y-auto pr-1"
                : "space-y-3"
            }
          >
            {filteredAssignments.map((item) => renderAssignmentCard(item))}
          </div>
        ) : (
          <article className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            {emptyStateText}
          </article>
        )}
      </section>

      {selectedAssignment ? (
        <div className="fixed inset-0 z-40 bg-slate-950/70 p-2 sm:p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="max-h-[92svh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedAssignment.title}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Курс: {selectedAssignment.course.title}
                  </p>
                  <p className="text-sm text-slate-600">
                    Урок:{" "}
                    {selectedAssignment.lessonTitle?.trim() || "Не указан"}
                  </p>
                  <p className="text-sm text-slate-600">
                    Дедлайн:{" "}
                    {selectedAssignment.dueAt
                      ? new Date(selectedAssignment.dueAt).toLocaleString()
                      : "Не указан"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  onClick={() => setSelectedAssignmentId(null)}
                >
                  Закрыть
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                  {selectedAssignment.description?.trim() ||
                    "Описание задания отсутствует."}
                </p>
              </div>

              {!selectedAssignment.submission &&
              !isOverdueByDueAt(selectedAssignment.dueAt) ? (
                <>
                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Текст решения
                  </label>
                  <textarea
                    value={textDrafts[selectedAssignment.id] ?? ""}
                    onChange={(event) =>
                      setTextDrafts((prev) => ({
                        ...prev,
                        [selectedAssignment.id]: event.target.value,
                      }))
                    }
                    className="mt-2 min-h-24 w-full rounded border border-slate-300 px-3 py-2"
                    placeholder="Опишите решение задания"
                  />

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Формулы (LaTeX/Math)
                      </label>
                      <textarea
                        value={formulaDrafts[selectedAssignment.id] ?? ""}
                        onChange={(event) =>
                          setFormulaDrafts((prev) => ({
                            ...prev,
                            [selectedAssignment.id]: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-20 w-full rounded border border-slate-300 px-3 py-2"
                        placeholder="Например: \int_0^1 x^2 dx = 1/3"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Код (programming)
                      </label>
                      <textarea
                        value={codeDrafts[selectedAssignment.id] ?? ""}
                        onChange={(event) =>
                          setCodeDrafts((prev) => ({
                            ...prev,
                            [selectedAssignment.id]: event.target.value,
                          }))
                        }
                        className="mt-2 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                        placeholder="Введите код решения"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-700">
                      Файлы любого типа
                    </label>
                    <input
                      type="file"
                      multiple
                      onChange={(event) =>
                        void handleFilesSelected(
                          selectedAssignment.id,
                          event.target.files,
                        )
                      }
                      className="mt-2 block w-full text-sm"
                    />

                    {(newAttachments[selectedAssignment.id] ?? []).length >
                    0 ? (
                      <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                        {(newAttachments[selectedAssignment.id] ?? []).map(
                          (attachment) => (
                            <li
                              key={`${selectedAssignment.id}-${attachment.name}-${attachment.size}`}
                              className="break-all"
                            >
                              {attachment.name} (
                              {Math.ceil(attachment.size / 1024)} KB)
                            </li>
                          ),
                        )}
                      </ul>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void submitAssignment(selectedAssignment)}
                      disabled={!!busy[selectedAssignment.id]}
                      className="w-full rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
                    >
                      {busy[selectedAssignment.id]
                        ? "Отправка..."
                        : "Отправить ответ"}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
