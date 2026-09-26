import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, className }: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center", className)}>
      <p className="font-semibold text-slate-900">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
