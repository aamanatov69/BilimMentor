"use client";

import { createElement, useEffect, useMemo, useRef, useState } from "react";

import { renderFormulaAsMathTypeHtml } from "@/lib/math-render";

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
    completedByTeacher?: boolean;
  };
  submission: AssignmentSubmission | null;
};

type AttachmentDraft = SubmissionAttachment & {
  dataBase64: string;
};

function isOverdue(dueAt: string | null) {
  if (!dueAt) return false;
  const ts = new Date(dueAt).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() > ts;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("bad_file"));
        return;
      }
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("read_error"));
    reader.readAsDataURL(file);
  });
}

export default function StudentAssignmentsPage() {
  const [rows, setRows] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [formulaDrafts, setFormulaDrafts] = useState<Record<string, string>>(
    {},
  );
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [attachmentDrafts, setAttachmentDrafts] = useState<
    Record<string, AttachmentDraft[]>
  >({});
  const mathFieldRefs = useRef<
    Record<
      string,
      | (HTMLElement & {
          value?: string;
          getValue?: (format?: string) => string;
        })
      | null
    >
  >({});

  useEffect(() => {
    void import("mathlive");
  }, []);

  const getMathFieldFormula = (assignmentId: string) => {
    const node = mathFieldRefs.current[assignmentId];
    if (!node) {
      return "";
    }

    const unstyled =
      typeof node.getValue === "function"
        ? node.getValue("latex-unstyled")
        : "";
    if (unstyled) {
      return unstyled;
    }

    return node.value ?? "";
  };

  const loadRows = async () => {
    setLoading(true);
    setError("");

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

      const assignments = data.assignments ?? [];
      setRows(assignments);
      setTextDrafts(
        Object.fromEntries(
          assignments.map((item) => [item.id, item.submission?.text ?? ""]),
        ),
      );
      setFormulaDrafts(
        Object.fromEntries(
          assignments.map((item) => [item.id, item.submission?.formula ?? ""]),
        ),
      );
      setCodeDrafts(
        Object.fromEntries(
          assignments.map((item) => [item.id, item.submission?.code ?? ""]),
        ),
      );
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const pendingRows = useMemo(
    () => rows.filter((item) => !item.submission && !isOverdue(item.dueAt)),
    [rows],
  );

  const completedRows = useMemo(
    () => rows.filter((item) => Boolean(item.submission)),
    [rows],
  );

  const missedRows = useMemo(
    () => rows.filter((item) => !item.submission && isOverdue(item.dueAt)),
    [rows],
  );

  const activeAssignment = useMemo(
    () => rows.find((item) => item.id === activeCardId) ?? null,
    [rows, activeCardId],
  );

  const handleSelectFiles = async (
    assignmentId: string,
    files: FileList | null,
  ) => {
    if (!files || files.length === 0) return;

    try {
      const mapped = await Promise.all(
        Array.from(files).map(async (file) => ({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataBase64: await fileToBase64(file),
        })),
      );

      setAttachmentDrafts((previous) => ({
        ...previous,
        [assignmentId]: [...(previous[assignmentId] ?? []), ...mapped],
      }));
    } catch {
      setError("Не удалось прочитать вложения");
    }
  };

  const submitAssignment = async (assignment: StudentAssignment) => {
    const text = (textDrafts[assignment.id] ?? "").trim();
    const formulaRaw = formulaDrafts[assignment.id] ?? "";
    const formula = formulaRaw.trim();
    const code = (codeDrafts[assignment.id] ?? "").trim();
    const attachments = attachmentDrafts[assignment.id] ?? [];

    if (isOverdue(assignment.dueAt)) {
      setError("Срок сдачи прошел");
      return;
    }

    if (!text && !formula && !code && attachments.length === 0) {
      setError("Добавьте текст, формулу, код или вложение");
      return;
    }

    setBusy((previous) => ({ ...previous, [assignment.id]: true }));
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/student/assignments/${assignment.id}/submit`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: text,
            formula: formulaRaw,
            code,
            attachments,
          }),
        },
      );

      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось отправить работу");
        return;
      }

      await loadRows();
      setActiveCardId(null);
      setAttachmentDrafts((previous) => ({ ...previous, [assignment.id]: [] }));
    } catch {
      setError("Ошибка сети при отправке");
    } finally {
      setBusy((previous) => ({ ...previous, [assignment.id]: false }));
    }
  };

  const renderCard = (assignment: StudentAssignment) => {
    const readOnlyCourse = assignment.course.completedByTeacher === true;

    return (
      <article
        key={assignment.id}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow"
      >
        <p className="text-sm font-semibold text-slate-900">
          {assignment.title}
        </p>
        <p className="mt-1 text-xs text-slate-600">{assignment.course.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          {assignment.lessonTitle || "Без урока"}
        </p>

        {readOnlyCourse ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            Курс завершен преподавателем. Доступен только просмотр задания.
          </p>
        ) : null}

        <p className="mt-2 text-xs text-slate-600">
          {assignment.dueAt
            ? `Срок: ${new Date(assignment.dueAt).toLocaleString("ru-RU")}`
            : "Срок не указан"}
        </p>

        <button
          type="button"
          disabled={readOnlyCourse}
          onClick={() => setActiveCardId(assignment.id)}
          className="mt-3 inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {readOnlyCourse
            ? "Только просмотр"
            : assignment.submission
              ? "Пересдать"
              : "Сдать"}
        </button>
      </article>
    );
  };

  return (
    <main className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {loading ? (
        <section className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`kanban-skeleton-${index}`}
              className="h-[420px] animate-pulse rounded-3xl border border-slate-200 bg-white"
            />
          ))}
        </section>
      ) : (
        <>
          {activeAssignment ? (
            <section className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {activeAssignment.submission
                      ? "Пересдача задания"
                      : "Сдача задания"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {activeAssignment.title} · {activeAssignment.course.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCardId(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Свернуть
                </button>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <textarea
                  value={textDrafts[activeAssignment.id] ?? ""}
                  onChange={(event) =>
                    setTextDrafts((previous) => ({
                      ...previous,
                      [activeAssignment.id]: event.target.value,
                    }))
                  }
                  placeholder="Текст ответа"
                  className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                />

                <textarea
                  value={formulaDrafts[activeAssignment.id] ?? ""}
                  onChange={(event) =>
                    setFormulaDrafts((previous) => ({
                      ...previous,
                      [activeAssignment.id]: event.target.value,
                    }))
                  }
                  placeholder="Формула (опционально)"
                  className="min-h-16 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                />

                <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                    MathType поле для формулы
                  </p>
                  <div className="mt-2 rounded-md border border-indigo-300 bg-white p-2">
                    {createElement("math-field", {
                      className:
                        "block min-h-12 w-full rounded-md border border-indigo-200 px-3 py-2 text-indigo-900",
                      value: formulaDrafts[activeAssignment.id] ?? "",
                      ref: (node: unknown) => {
                        mathFieldRefs.current[activeAssignment.id] =
                          (node as
                            | (HTMLElement & {
                                value?: string;
                                getValue?: (format?: string) => string;
                              })
                            | null) ?? null;
                      },
                      onInput: (event: Event) => {
                        const target = event.target as EventTarget & {
                          value?: string;
                          getValue?: (format?: string) => string;
                        };
                        const unstyled =
                          typeof target.getValue === "function"
                            ? target.getValue("latex-unstyled")
                            : "";
                        setFormulaDrafts((previous) => ({
                          ...previous,
                          [activeAssignment.id]: unstyled || target.value || "",
                        }));
                      },
                    })}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const formulaValue = getMathFieldFormula(
                          activeAssignment.id,
                        );
                        if (!formulaValue) {
                          return;
                        }

                        setFormulaDrafts((previous) => ({
                          ...previous,
                          [activeAssignment.id]: formulaValue,
                        }));
                      }}
                      className="rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    >
                      Вставить в поле формулы
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const formulaValue = getMathFieldFormula(
                          activeAssignment.id,
                        );
                        if (!formulaValue) {
                          return;
                        }

                        setTextDrafts((previous) => ({
                          ...previous,
                          [activeAssignment.id]: `${previous[activeAssignment.id] ?? ""}[[MATH:${formulaValue}]]`,
                        }));
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Вставить в текст ответа
                    </button>
                  </div>
                  {formulaDrafts[activeAssignment.id]?.trim() ? (
                    <div className="mt-2 rounded-md border border-indigo-200 bg-white p-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                        Предпросмотр формулы
                      </p>
                      <div
                        className="mt-2 overflow-x-auto text-slate-900"
                        dangerouslySetInnerHTML={{
                          __html: renderFormulaAsMathTypeHtml(
                            formulaDrafts[activeAssignment.id],
                          ),
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <textarea
                  value={codeDrafts[activeAssignment.id] ?? ""}
                  onChange={(event) =>
                    setCodeDrafts((previous) => ({
                      ...previous,
                      [activeAssignment.id]: event.target.value,
                    }))
                  }
                  placeholder="Код (опционально)"
                  className="min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                />

                <label className="inline-flex w-fit cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Добавить файлы
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) =>
                      void handleSelectFiles(
                        activeAssignment.id,
                        event.target.files,
                      )
                    }
                  />
                </label>

                {(attachmentDrafts[activeAssignment.id] ?? []).length ? (
                  <ul className="space-y-1 text-xs text-slate-600">
                    {(attachmentDrafts[activeAssignment.id] ?? []).map(
                      (file, index) => (
                        <li key={`${activeAssignment.id}-file-${index}`}>
                          • {file.name}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy[activeAssignment.id]}
                    onClick={() => void submitAssignment(activeAssignment)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busy[activeAssignment.id] ? "Отправка..." : "Отправить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCardId(null)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className={
              activeAssignment
                ? "grid gap-4 xl:grid-cols-3 opacity-70 transition-opacity"
                : "grid gap-4 xl:grid-cols-3"
            }
          >
            <article className="rounded-3xl border border-amber-200 bg-amber-50/40 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
                Доступные ({pendingRows.length})
              </h2>
              <div className="mt-3 space-y-2">
                {pendingRows.length ? (
                  pendingRows.map(renderCard)
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700">
                    <p>Нет доступных заданий.</p>
                    <p className="mt-1 text-xs text-amber-700/90">
                      Проверьте раздел курсов: возможно, доступ к новому курсу
                      еще не подтвержден.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
                Сданы ({completedRows.length})
              </h2>
              <div className="mt-3 space-y-2">
                {completedRows.length ? (
                  completedRows.map(renderCard)
                ) : (
                  <div className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-sm text-emerald-700">
                    <p>Пока ничего не сдано.</p>
                    <p className="mt-1 text-xs text-emerald-700/90">
                      После первой отправки здесь появится история ваших работ.
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article className="rounded-3xl border border-rose-200 bg-rose-50/40 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-700">
                Просроченные ({missedRows.length})
              </h2>
              <div className="mt-3 space-y-2">
                {missedRows.length ? (
                  missedRows.map(renderCard)
                ) : (
                  <div className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700">
                    <p>Просроченных нет.</p>
                    <p className="mt-1 text-xs text-rose-700/90">
                      Отличный темп. Старайтесь отправлять задания до дедлайна.
                    </p>
                  </div>
                )}
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
