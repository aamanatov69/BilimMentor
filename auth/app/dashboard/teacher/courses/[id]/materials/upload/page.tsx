"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function UploadMaterialPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const clearSelectedFile = () => {
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const upload = async () => {
    if (!fileName.trim()) {
      setError("Выберите файл");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/api/teacher/courses/${id}/materials`, {
          credentials: "include",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: fileName }),
        },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось загрузить материал");
        return;
      }
      setMessage(data.message ?? "Материал добавлен");
      clearSelectedFile();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
      <h1 className="text-2xl font-semibold">Загрузка материала</h1>
      <p className="mt-2 text-slate-600">Курс: {id}</p>

      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <input
          ref={fileInputRef}
          id="material-file"
          type="file"
          className="hidden"
          onChange={(event) =>
            setFileName(event.target.files?.[0]?.name?.trim() ?? "")
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor="material-file"
            className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Добавить файл
          </label>
          <p className="text-sm text-slate-600">
            Поддерживается выбор одного файла.
          </p>
        </div>

        {fileName ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="truncate text-sm text-slate-700">{fileName}</p>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
            >
              Убрать
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Файл еще не выбран.</p>
        )}
      </div>

      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void upload()}
          disabled={loading}
          className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800"
        >
          {loading ? "Загрузка..." : "Загрузить"}
        </button>
        <Link
          href={`/dashboard/teacher/courses/${id}`}
          className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50"
        >
          Назад
        </Link>
      </div>
    </main>
  );
}
