"use client";

import "katex/dist/katex.min.css";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

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

function normalizeMarkdownMath(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\[\[(MATH|CHEM):([\s\S]*?)\]\]/g, (_match, _type, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `\n$$\n${value}\n$$\n` : "";
    })
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `\n$$\n${value}\n$$\n` : "";
    })
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `$${value}$` : "";
    })
    .replace(/\$\$([^\n$][^\n]*?[^\n$]?)\$\$/g, (_match, formula) => {
      const value = String(formula ?? "").trim();
      return value ? `$${value}$` : "";
    });
}

function safeUrlTransform(url: string) {
  if (/^\/uploads\//i.test(url)) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${url}`;
    }
    return url;
  }

  if (/^data:image\//i.test(url)) {
    return url;
  }

  return defaultUrlTransform(url);
}

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

function compactPlainText(value: string | null | undefined) {
  const source = String(value ?? "").trim();
  if (!source) {
    return "";
  }

  return source
    .replace(/\[\[(MATH|CHEM):([\s\S]*?)\]\]/g, " $2 ")
    .replace(/[`*_>#\-]/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export default function StudentAssignmentsPage() {
  const [rows, setRows] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [attachmentDrafts, setAttachmentDrafts] = useState<
    Record<string, AttachmentDraft[]>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

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
      setAnswerDrafts(
        Object.fromEntries(
          assignments.map((item) => {
            const parts = [item.submission?.text ?? ""];
            const formula = (item.submission?.formula ?? "").trim();
            const code = (item.submission?.code ?? "").trim();
            if (formula) {
              parts.push(`\n$$\n${formula}\n$$\n`);
            }
            if (code) {
              parts.push(`\n\`\`\`\n${code}\n\`\`\`\n`);
            }

            return [item.id, parts.join("\n").trim()];
          }),
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
    const text = (answerDrafts[assignment.id] ?? "").trim();
    const attachments = attachmentDrafts[assignment.id] ?? [];

    if (isOverdue(assignment.dueAt)) {
      setError("Срок сдачи прошел");
      return;
    }

    if (!text && attachments.length === 0) {
      setError("Добавьте текст ответа или вложение");
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
            formula: "",
            code: "",
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

  const uploadPastedImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file, file.name || "pasted-image.png");

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const payload = (await response.json()) as {
      url?: string;
      message?: string;
    };

    if (!response.ok || !payload.url) {
      throw new Error(payload.message || "Не удалось загрузить изображение");
    }

    return payload.url;
  };

  const handlePasteImages = async (
    assignmentId: string,
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (!imageFiles.length) {
      return;
    }

    event.preventDefault();

    const textarea = textareaRefs.current[assignmentId];
    const current = answerDrafts[assignmentId] ?? "";
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;

    try {
      const uploadedUrls = await Promise.all(
        imageFiles.map((file) => uploadPastedImage(file)),
      );

      const insertion = `\n${uploadedUrls.map((url) => `![image](${url})`).join("\n\n")}\n`;
      const nextValue =
        current.slice(0, start) + insertion + current.slice(end);

      setAnswerDrafts((previous) => ({
        ...previous,
        [assignmentId]: nextValue,
      }));

      window.requestAnimationFrame(() => {
        const nextTextarea = textareaRefs.current[assignmentId];
        if (!nextTextarea) {
          return;
        }
        const cursor = start + insertion.length;
        nextTextarea.focus();
        nextTextarea.setSelectionRange(cursor, cursor);
      });
    } catch (pasteError) {
      setError(
        pasteError instanceof Error
          ? pasteError.message
          : "Не удалось загрузить изображение",
      );
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
        {compactPlainText(assignment.description) ? (
          <p className="mt-2 line-clamp-3 text-xs text-slate-600">
            {compactPlainText(assignment.description)}
          </p>
        ) : null}

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
          className="mt-3 inline-flex h-8 min-w-[130px] items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                {activeAssignment.description ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Условие задания
                    </p>
                    <div className="prose prose-slate max-w-none break-words text-sm leading-6">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        urlTransform={safeUrlTransform}
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noreferrer" />
                          ),
                          img: ({ node, ...props }) => (
                            <img
                              {...props}
                              className="my-3 max-h-[360px] w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                              loading="lazy"
                            />
                          ),
                        }}
                      >
                        {normalizeMarkdownMath(activeAssignment.description)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : null}

                <textarea
                  ref={(node) => {
                    textareaRefs.current[activeAssignment.id] = node;
                  }}
                  value={answerDrafts[activeAssignment.id] ?? ""}
                  onChange={(event) =>
                    setAnswerDrafts((previous) => ({
                      ...previous,
                      [activeAssignment.id]: event.target.value,
                    }))
                  }
                  onPaste={(event) => {
                    void handlePasteImages(activeAssignment.id, event);
                  }}
                  placeholder="Ответ: Markdown, LaTeX ($$y = x^2$$), ссылки и фото через Ctrl+V"
                  className="min-h-40 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none"
                />

                {(answerDrafts[activeAssignment.id] ?? "").trim() ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Preview
                    </p>
                    <div className="prose prose-slate max-w-none break-words text-sm leading-6">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        urlTransform={safeUrlTransform}
                        components={{
                          a: ({ node, ...props }) => (
                            <a {...props} target="_blank" rel="noreferrer" />
                          ),
                          img: ({ node, ...props }) => (
                            <img
                              {...props}
                              className="my-3 max-h-[360px] w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                              loading="lazy"
                            />
                          ),
                        }}
                      >
                        {normalizeMarkdownMath(
                          answerDrafts[activeAssignment.id] ?? "",
                        )}
                      </ReactMarkdown>
                    </div>
                  </div>
                ) : null}

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
                    className="h-9 min-w-[120px] rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {busy[activeAssignment.id] ? "Отправка..." : "Отправить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCardId(null)}
                    className="h-9 min-w-[120px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
