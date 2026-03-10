"use client";

import { useParams } from "next/navigation";

export default function CourseStudentsPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">Студенты курса {id}</h1>
      <p className="mt-2 text-slate-600">
        Здесь отображается список студентов, записанных на курс.
      </p>
    </main>
  );
}
