"use client";

import Link from "next/link";
import { useRef } from "react";

export function CourseActions({ id, title, disabled, onDelete }: {
  id: string;
  title: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={details} className="min-w-36" onKeyDown={(event) => {
      if (event.key === "Escape" && details.current?.open) {
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      }
    }} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
    }}>
      <summary aria-label={`Действия с курсом «${title}»`} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus-visible:outline focus-visible:outline-blue-600">
        Действия
      </summary>
      <div className="mt-1 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
        <Link className="rounded px-3 py-2 text-blue-700 hover:bg-white" href={`/dashboard/admin/courses/${id}/students`}>Студенты курса</Link>
        <Link className="rounded px-3 py-2 text-blue-700 hover:bg-white" href={`/dashboard/admin/courses/${id}/teacher`}>Назначить преподавателя</Link>
        <button type="button" disabled={disabled} className="rounded px-3 py-2 text-left text-rose-700 hover:bg-rose-50 disabled:opacity-50" onClick={() => {
          if (details.current) {
            details.current.open = false;
            details.current.querySelector("summary")?.focus();
          }
          onDelete();
        }}>Удалить курс</button>
      </div>
    </details>
  );
}
