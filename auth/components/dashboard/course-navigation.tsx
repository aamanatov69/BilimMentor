import Link from "next/link";

export function CourseNavigation({ courseId, active }: {
  courseId: string;
  active: "courses" | "assignments" | "students" | "grades" | "settings";
}) {
  if (!courseId) return null;
  const sections = [
    ["courses", "Уроки"], ["assignments", "Проверка работ"],
    ["students", "Студенты"], ["grades", "Оценки"], ["settings", "Настройки"],
  ] as const;
  return (
    <nav aria-label="Разделы выбранного курса" className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
      {sections.map(([path, label]) => <Link key={path}
        href={path === "settings" ? `/dashboard/teacher/courses/${encodeURIComponent(courseId)}/settings` : `/dashboard/teacher/${path}?course=${encodeURIComponent(courseId)}`}
        aria-current={active === path ? "page" : undefined}
        className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-blue-600 ${active === path ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}>{label}</Link>)}
      <Link href="/dashboard/teacher/courses" className="ml-auto inline-flex min-h-11 items-center px-3 text-sm text-blue-700">Все курсы</Link>
    </nav>
  );
}
