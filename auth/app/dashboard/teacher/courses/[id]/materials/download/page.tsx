"use client";

import { useParams } from "next/navigation";

export default function DownloadMaterialPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">
        Скачивание материалов курса {id}
      </h1>
      <p className="mt-2 text-slate-600">
        Здесь вы сможете скачать выбранные материалы.
      </p>
    </main>
  );
}
