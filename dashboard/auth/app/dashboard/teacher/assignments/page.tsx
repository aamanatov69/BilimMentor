"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
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
  const [activeTab, setActiveTab] = useState<"unviewed" | "viewed">("unviewed");
  const [rows, setRows] = useState<AssignmentAnswerRow[]>([]);
  const [previewRow, setPreviewRow] = useState<AssignmentAnswerRow | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busyAttachmentId, setBusyAttachmentId] = useState("");
  const [listMaxHeight, setListMaxHeight] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const isViewed = (item: AssignmentAnswerRow) =>
    item.score !== null && typeof item.score !== "undefined"
      ? true
      : Boolean(item.feedback?.trim());

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
          rows?: AssignmentAnswerRow[];
          message?: string;
        };

        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить ответы студентов");
          return;
        }

        setRows(data.rows ?? []);
      } catch {
        setError("Ошибка сети");
      }
    };

    void loadRows();
  }, []);

  useEffect(() => {
    const currentRows =
      activeTab === "viewed"
        ? rows.filter((item) => isViewed(item))
        : rows.filter((item) => !isViewed(item));

    if (currentRows.length <= 4) {
      setListMaxHeight(null);
      return;
    }

    const updateHeight = () => {
      const listElement = listRef.current;
      if (!listElement) {
        setListMaxHeight(null);
        return;
      }

      const cards = Array.from(
        listElement.querySelectorAll<HTMLElement>("[data-answer-card='true']"),
      ).slice(0, 4);

      if (cards.length < 4) {
        setListMaxHeight(null);
        return;
      }

      const cardsHeight = cards.reduce(
        (total, card) => total + card.offsetHeight,
        0,
      );
      const gapsHeight = 12 * 3;
      setListMaxHeight(cardsHeight + gapsHeight);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, [rows, activeTab]);

  const viewedRows = rows.filter((item) => isViewed(item));

  const unviewedRows = rows.filter((item) => !isViewed(item));

  const filteredRows = activeTab === "viewed" ? viewedRows : unviewedRows;

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Задания</h1>
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

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("unviewed")}
          className={
            activeTab === "unviewed"
              ? "rounded-full border border-amber-700 bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          Не просмотренные ({unviewedRows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("viewed")}
          className={
            activeTab === "viewed"
              ? "rounded-full border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white"
              : "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          Просмотренные ({viewedRows.length})
        </button>
      </div>

      {filteredRows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          {activeTab === "viewed"
            ? "Пока нет просмотренных ответов студентов."
            : "Пока нет не просмотренных ответов студентов."}
        </p>
      ) : (
        <div
          ref={listRef}
          className={
            filteredRows.length > 4
              ? "mt-4 space-y-3 overflow-y-auto pr-1"
              : "mt-4 space-y-3"
          }
          style={
            filteredRows.length > 4 && listMaxHeight
              ? { maxHeight: listMaxHeight }
              : undefined
          }
        >
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
                  href={`/dashboard/teacher/grades?submissionId=${row.submissionId}`}
                  className="text-blue-700 hover:underline"
                >
                  Комментарий
                </Link>
                <Link
                  href={`/dashboard/teacher/grades?submissionId=${row.submissionId}`}
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
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {previewRow.answerText}
                </p>
              </div>
            ) : null}

            {previewRow.answerFormula ? (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-500">Формулы</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {previewRow.answerFormula}
                </p>
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
                href={`/dashboard/teacher/grades?submissionId=${previewRow.submissionId}`}
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
