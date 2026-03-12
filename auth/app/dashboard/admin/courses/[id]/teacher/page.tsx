"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function AdminAssignTeacherPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const assign = async () => {

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_URL}/api/admin/courses/${id}`, {
          credentials: "include",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teacher_id: teacherId }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось назначить преподавателя");
        return;
      }
      setMessage("Преподаватель назначен");
      setTeacherId("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-xl">
      <h1 className="text-2xl font-semibold">
        Назначить преподавателя для курса {id}
      </h1>
      <input
        className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
        placeholder="ID преподавателя (например u2)"
        value={teacherId}
        onChange={(event) => setTeacherId(event.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
      {message ? (
        <p className="mt-2 text-sm text-emerald-700">{message}</p>
      ) : null}
      <button
        type="button"
        onClick={() => void assign()}
        disabled={loading}
        className="mt-3 rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {loading ? "Назначение..." : "Назначить"}
      </button>
    </main>
  );
}
