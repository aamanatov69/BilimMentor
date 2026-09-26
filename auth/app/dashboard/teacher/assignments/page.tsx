"use client";

import { EmptyState } from "@/components/ui/empty-state";

import { apiJson, apiErrorMessage } from "@/lib/api-client";

import { CourseNavigation } from "@/components/dashboard/course-navigation";

import "katex/dist/katex.min.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

import { renderFormulaAsMathTypeHtml } from "@/lib/math-render";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

type AttachmentItem = {
  name: string;
  type: string;
  size: number;
  dataBase64?: string;
};

type AssignmentAnswerRow = {
  submissionId: string;
  studentId: string;
  courseId: string;
  studentName: string;
  assignmentTitle: string;
  courseTitle: string;
  submittedAt: string;
  score?: number | null;
  feedback?: string | null;
  answerText?: string;
  answerFormula?: string;
  answerCode?: string;
  answerAttachments?: AttachmentItem[];
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

function formatSize(bytes?: number) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function base64ToBlob(base64Raw: string, mimeType: string) {
  const cleaned = base64Raw
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded =
    cleaned + (cleaned.length % 4 ? "=".repeat(4 - (cleaned.length % 4)) : "");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

export default function TeacherAssignmentsPage() {
  return <Suspense fallback={<p role="status">Загрузка работ…</p>}><TeacherAssignmentsContent /></Suspense>;
}

function TeacherAssignmentsContent() {
  const searchParams = useSearchParams();
  const targetSubmissionId = searchParams.get("submissionId") ?? "";
  const [activeTab, setActiveTab] = useState<"unviewed" | "viewed">("unviewed");
  const [rows, setRows] = useState<AssignmentAnswerRow[]>([]);
  const [previewRow, setPreviewRow] = useState<AssignmentAnswerRow | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busyAttachmentId, setBusyAttachmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const courseFilter = searchParams.get("course") ?? "";
  const setCourseFilter = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set("course", value); else params.delete("course");
    params.delete("submissionId");
    window.history.pushState(null, "", `${window.location.pathname}?${params}`);
  };
  const [sort, setSort] = useState("oldest");
  const isViewed = (item: AssignmentAnswerRow) => item.score !== null && item.score !== undefined;

  const getAttachmentBlobUrl = async (attachment: AttachmentItem) => {
    if (!attachment.dataBase64) {
      throw new Error("attachment_unavailable");
    }

    const mimeType = attachment.type?.trim() || "application/octet-stream";
    const blob = base64ToBlob(attachment.dataBase64, mimeType);
    return URL.createObjectURL(blob);
  };

  const openAttachment = async (attachment: AttachmentItem, id: string) => {
    setBusyAttachmentId(id);
    setError("");

    const openedWindow = window.open("about:blank", "_blank");

    try {
      const blobUrl = await getAttachmentBlobUrl(attachment);

      if (openedWindow && !openedWindow.closed) {
        openedWindow.location.href = blobUrl;
      } else {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.download = attachment.name || "answer-file";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
    } catch {
      if (openedWindow && !openedWindow.closed) {
        openedWindow.close();
      }
      setError("Не удалось открыть файл ответа");
    } finally {
      setBusyAttachmentId("");
    }
  };

  const downloadAttachment = async (attachment: AttachmentItem, id: string) => {
    setBusyAttachmentId(id);
    setError("");

    try {
      const blobUrl = await getAttachmentBlobUrl(attachment);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = attachment.name || "answer-file";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch {
      setError("Не удалось скачать файл ответа");
    } finally {
      setBusyAttachmentId("");
    }
  };

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiJson<{ rows?: AssignmentAnswerRow[] }>("/api/teacher/grades");

        setRows(data.rows ?? []);
      } catch (error) {
        setError(apiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [retry]);

  const courseRows = rows.filter((item) => !courseFilter || item.courseId === courseFilter);
  const viewedRows = courseRows.filter((item) => isViewed(item));

  const unviewedRows = courseRows.filter((item) => !isViewed(item));

  const courseOptions = [...new Map(rows.map((row) => [row.courseId, row.courseTitle])).entries()];
  const filteredRows = (activeTab === "viewed" ? viewedRows : unviewedRows)
    .filter((row) => (!courseFilter || row.courseId === courseFilter) &&
      `${row.studentName} ${row.assignmentTitle}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => {
      const delta = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
      return (sort === "oldest" ? delta : -delta) || a.submissionId.localeCompare(b.submissionId);
    });

  useEffect(() => {
    if (!targetSubmissionId || rows.length === 0) {
      return;
    }

    const targetRow = rows.find(
      (item) => item.submissionId === targetSubmissionId,
    );

    if (!targetRow) {
      return;
    }

    setActiveTab(isViewed(targetRow) ? "viewed" : "unviewed");
    setPreviewRow(targetRow);
  }, [targetSubmissionId, rows]);

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <CourseNavigation courseId={courseFilter} active="assignments" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Проверка работ</h1>
        <Link
          href="/dashboard/teacher/grades"
          className="rounded border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
        >
          Перейти к оценкам
        </Link>
      </div>

      <p className="mt-2 text-sm text-slate-600">
        Ответы студентов на задания, которые были даны в уроках.
      </p>

      {error ? <div role="alert" className="mt-3 text-sm text-rose-600">{error} <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 px-3 underline">Повторить загрузку</button></div> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={activeTab === "unviewed"}
          onClick={() => setActiveTab("unviewed")}
          className={
            activeTab === "unviewed"
              ? "rounded-full border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          Ожидают оценки ({loading ? "…" : unviewedRows.length})
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "viewed"}
          onClick={() => setActiveTab("viewed")}
          className={
            activeTab === "viewed"
              ? "rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          Оценены ({loading ? "…" : viewedRows.length})
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm">Студент или задание<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border px-3" /></label>
        <label className="text-sm">Курс<select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"><option value="">Все курсы</option>{courseOptions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label className="text-sm">Порядок проверки<select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-white px-3"><option value="oldest">Дольше всего ждут</option><option value="newest">Сначала новые</option></select></label>
      </div>
      {!loading && !error && activeTab === "unviewed" && filteredRows.length > 0 ? <Link href={`/dashboard/teacher/grades?course=${encodeURIComponent(filteredRows[0].courseId)}&submissionId=${encodeURIComponent(filteredRows[0].submissionId)}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 font-semibold text-white">Проверить следующую работу</Link> : null}

      {loading ? <p role="status" className="mt-4 p-4">Загрузка работ…</p> : error ? null : filteredRows.length === 0 ? (
        <EmptyState className="mt-4"
          title={query || courseFilter ? "Работы не найдены" : activeTab === "viewed" ? "Оценённых работ пока нет" : "Нет работ, ожидающих оценки"}
          description={query || courseFilter ? "Измените запрос или выберите другой курс." : "Новые работы появятся после отправки студентами."}
          action={query || courseFilter ? <button type="button" className="min-h-11 rounded-lg border bg-white px-4 text-sm font-semibold" onClick={() => { setQuery(""); setCourseFilter(""); }}>Сбросить фильтры</button> : <Link href="/dashboard/teacher/courses" className="inline-flex min-h-11 items-center rounded-lg border bg-white px-4 text-sm font-semibold">Перейти к курсам</Link>}
        />
      ) : (
        <div className="mt-4 space-y-3">
          {filteredRows.map((row) => (
            <article
              data-answer-card="true"
              key={row.submissionId}
              className="rounded border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="break-words font-medium">
                    {row.assignmentTitle}
                  </p>
                  <p className="text-xs text-slate-500">
                    Курс: {row.courseTitle}
                  </p>
                  <p className="text-xs text-slate-500">
                    Студент: {row.studentName}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(row.submittedAt).toLocaleString()}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setPreviewRow(row)}
                  className="rounded border border-blue-200 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                >
                  Просмотреть
                </button>
                <Link
                  href={`/dashboard/teacher/grades?course=${encodeURIComponent(row.courseId)}&submissionId=${encodeURIComponent(row.submissionId)}`}
                  className="text-blue-700 hover:underline"
                >
                  Комментарий
                </Link>
                <Link
                  href={`/dashboard/teacher/grades?course=${encodeURIComponent(row.courseId)}&submissionId=${encodeURIComponent(row.submissionId)}`}
                  className="text-blue-700 hover:underline"
                >
                  Оценить
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {previewRow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-3 sm:p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Содержимое ответа</h2>
                <p className="text-sm text-slate-600">
                  {previewRow.assignmentTitle}
                </p>
                <p className="text-xs text-slate-500">
                  Курс: {previewRow.courseTitle} • Студент:{" "}
                  {previewRow.studentName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              >
                Закрыть
              </button>
            </div>

            {previewRow.answerText ? (
              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">
                  Текст ответа
                </p>
                <div className="prose prose-slate mt-2 max-w-none overflow-x-auto break-words text-sm leading-6 text-slate-700">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    urlTransform={safeUrlTransform}
                    components={{
                      a: ({ node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" />
                      ),
                      img: ({ node, ...props }) =>
                        props.src ? (
                          <img
                            {...props}
                            className="my-3 max-h-[420px] w-auto max-w-full rounded-lg border border-slate-200 object-contain"
                            loading="lazy"
                          />
                        ) : null,
                    }}
                  >
                    {normalizeMarkdownMath(previewRow.answerText)}
                  </ReactMarkdown>
                </div>
              </div>
            ) : null}

            {previewRow.answerFormula ? (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Формулы</p>
                <div
                  className="mt-2 overflow-x-auto break-words text-slate-900"
                  dangerouslySetInnerHTML={{
                    __html: renderFormulaAsMathTypeHtml(
                      previewRow.answerFormula,
                    ),
                  }}
                />
              </div>
            ) : null}

            {previewRow.answerCode ? (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Код</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                  {previewRow.answerCode}
                </pre>
              </div>
            ) : null}

            {(previewRow.answerAttachments ?? []).length > 0 ? (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">
                  Файлы ответа
                </p>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {(previewRow.answerAttachments ?? []).map(
                    (attachment, index) => (
                      <li
                        key={`${previewRow.submissionId}-preview-att-${index + 1}`}
                        className="flex flex-wrap items-center justify-between gap-2 break-all"
                      >
                        <span>
                          {attachment.name} ({attachment.type},{" "}
                          {formatSize(attachment.size)})
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                            disabled={
                              busyAttachmentId ===
                              `${previewRow.submissionId}-preview-att-${index + 1}`
                            }
                            onClick={() =>
                              void openAttachment(
                                attachment,
                                `${previewRow.submissionId}-preview-att-${index + 1}`,
                              )
                            }
                          >
                            {busyAttachmentId ===
                            `${previewRow.submissionId}-preview-att-${index + 1}`
                              ? "Открытие..."
                              : "Просмотреть"}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                            disabled={
                              busyAttachmentId ===
                              `${previewRow.submissionId}-preview-att-${index + 1}`
                            }
                            onClick={() =>
                              void downloadAttachment(
                                attachment,
                                `${previewRow.submissionId}-preview-att-${index + 1}`,
                              )
                            }
                          >
                            Скачать
                          </button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}

            {!previewRow.answerText &&
            !previewRow.answerFormula &&
            !previewRow.answerCode &&
            (previewRow.answerAttachments ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">
                В ответе пока нет содержимого.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/teacher/grades?course=${encodeURIComponent(previewRow.courseId)}&submissionId=${encodeURIComponent(previewRow.submissionId)}`}
                className="rounded bg-blue-700 px-3 py-2 text-sm text-white hover:bg-blue-800"
              >
                Оценить
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
