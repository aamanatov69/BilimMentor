import { cn } from "@/lib/utils";

const statuses = {
  published: { label: "Опубликован", color: "bg-emerald-100 text-emerald-800" },
  hidden: { label: "Скрыт", color: "bg-slate-100 text-slate-700" },
  approved: { label: "Доступ открыт", color: "bg-emerald-100 text-emerald-800" },
  pending: { label: "На рассмотрении", color: "bg-amber-100 text-amber-800" },
  rejected: { label: "Заявка отклонена", color: "bg-rose-100 text-rose-800" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof statuses }) {
  const value = statuses[status];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", value.color)}>{value.label}</span>;
}
