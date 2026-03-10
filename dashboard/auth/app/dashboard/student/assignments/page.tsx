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

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

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
  const [openedForms, setOpenedForms] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    const loadAssignments = async () => {
      const token = getTokenFromCookie();
      if (!token) {
        setError("Требуется авторизация");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/student/assignments`, {
          headers: { Authorization: `Bearer ${token}` },
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
          type: file.type,
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
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

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
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
      setOpenedForms((prev) => ({ ...prev, [assignment.id]: false }));

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

  const renderAssignmentCard = (item: StudentAssignment) => (
    <article
      key={item.id}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {/** Form is intentionally hidden until user opens it for this assignment. */}
      {(() => {
        const isFormOpen = !!openedForms[item.id];
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
                  Курс: {item.course.title} • Преподаватель:{" "}
                  {item.course.teacher}
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

            {item.description ? (
              <p className="mt-3 break-words text-sm text-slate-700">
                {item.description}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {!item.submission ? (
                <button
                  type="button"
                  disabled={isBlockedByDeadline}
                  onClick={() =>
                    setOpenedForms((prev) => ({
                      ...prev,
                      [item.id]: !isFormOpen,
                    }))
                  }
                  className="w-full rounded border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isBlockedByDeadline
                    ? "Срок истек"
                    : isFormOpen
                      ? "Скрыть форму ответа"
                      : "Отправить ответ"}
                </button>
              ) : null}

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

            {isFormOpen && !isBlockedByDeadline ? (
              <>
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Текст решения
                </label>
                <textarea
                  value={textDrafts[item.id] ?? ""}
                  onChange={(event) =>
                    setTextDrafts((prev) => ({
                      ...prev,
                      [item.id]: event.target.value,
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
                      value={formulaDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setFormulaDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
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
                      value={codeDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setCodeDrafts((prev) => ({
                          ...prev,
                          [item.id]: event.target.value,
                        }))
                      }
                      className="mt-2 min-h-20 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                      placeholder="Введите код решения"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Файлы (Word, Excel, PowerPoint, PDF)
                  </label>
                  <div className="mt-2">
                    <input
                      id={`camera-${item.id}`}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={(event) =>
                        void handleFilesSelected(item.id, event.target.files)
                      }
                    />
                    <label
                      htmlFor={`camera-${item.id}`}
                      className="inline-flex cursor-pointer rounded border border-sky-300 px-3 py-1.5 text-sm text-sky-700 hover:bg-sky-50"
                    >
                      Сфотографировать и прикрепить
                    </label>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv,.zip,.rar,.7z,image/*,video/*,audio/*,.json,.xml,.html,.md,.js,.ts,.py,.java,.c,.cpp,.cs"
                    onChange={(event) =>
                      void handleFilesSelected(item.id, event.target.files)
                    }
                    className="mt-2 block w-full text-sm"
                  />

                  {(newAttachments[item.id] ?? []).length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                      {(newAttachments[item.id] ?? []).map((attachment) => (
                        <li
                          key={`${item.id}-${attachment.name}-${attachment.size}`}
                          className="break-all"
                        >
                          {attachment.name} ({Math.ceil(attachment.size / 1024)}{" "}
                          KB)
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {(item.submission?.attachments ?? []).length > 0 ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                      {(item.submission?.attachments ?? []).map(
                        (attachment) => (
                          <li
                            key={`${item.submission?.id}-${attachment.name}-${attachment.size}`}
                            className="break-all"
                          >
                            Уже отправлено: {attachment.name} (
                            {Math.ceil(attachment.size / 1024)} KB)
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void submitAssignment(item)}
                    disabled={!!busy[item.id]}
                    className="w-full rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
                  >
                    {busy[item.id] ? "Отправка..." : "Отправить преподавателю"}
                  </button>
                </div>
              </>
            ) : null}

            {item.submission?.grade !== null ? (
              <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-medium text-emerald-800">
                  Оценка: {item.submission?.grade}
                </p>
                <p className="text-emerald-900">
                  Комментарий: {item.submission?.feedback ?? "-"}
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
    </main>
  );
}
