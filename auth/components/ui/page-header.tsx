import type { ReactNode } from "react";

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0"><h1 className="text-2xl font-semibold text-slate-900">{title}</h1>{description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}</div>
    {action}
  </header>;
}
