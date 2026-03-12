"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function TeacherCourseDeletePage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/teacher/courses/${id}`, {
        credentials: "include",
        method: "DELETE",
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить курс");
        return;
      }
      router.replace("/dashboard/teacher/courses");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main>
      {error ? (
        <p className="mx-auto mt-6 max-w-xl text-sm text-rose-600">{error}</p>
      ) : null}
      <ConfirmModal
        isOpen
        title="Удалить курс?"
        description="Курс и связанные материалы будут удалены без возможности восстановления."
        confirmText="Подтвердить"
        cancelText="Отмена"
        isBusy={loading}
        onConfirm={() => void remove()}
        onCancel={() => router.replace(`/dashboard/teacher/courses/${id}`)}
      />
    </main>
  );
}
