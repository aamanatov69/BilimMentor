"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { CourseNavigation } from "@/components/dashboard/course-navigation";
import { PageHeader } from "@/components/ui/page-header";
import { LoadError } from "@/components/ui/load-error";
import { StatusBadge } from "@/components/ui/status-badge";
import { apiJson, apiErrorMessage } from "@/lib/api-client";

type CourseSettings = { title: string; description: string; category: string; level: "beginner" | "intermediate" | "advanced"; isPublished: boolean };
export default function CourseSettingsPage() {
  const courseId = String(useParams().id ?? "");
  const [course, setCourse] = useState<CourseSettings | null>(null);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const dirty = Boolean(course && JSON.stringify(course) !== saved);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError(""); setCourse(null);
    void apiJson<{ course: CourseSettings }>(`/api/teacher/courses/${encodeURIComponent(courseId)}/details`, { signal: controller.signal })
      .then(({ course }) => {
        if (controller.signal.aborted) return;
        const fields = { title: course.title, description: course.description, category: course.category, level: course.level, isPublished: course.isPublished };
        setCourse(fields); setSaved(JSON.stringify(fields));
      }).catch((error) => { if (!controller.signal.aborted) setLoadError(apiErrorMessage(error)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [courseId, retry]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!course || busy) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const { title, description, category, level } = course;
      await apiJson(`/api/teacher/courses/${encodeURIComponent(courseId)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), description: description.trim(), category: category.trim(), level }) });
      setSaved(JSON.stringify(course)); setInfo("Настройки курса сохранены.");
    } catch (error) { setError(apiErrorMessage(error)); }
    finally { setBusy(false); }
  };
  return <main className="space-y-5">
    <CourseNavigation courseId={courseId} active="settings" />
    <PageHeader title="Настройки курса" description="Название, описание, категория и уровень курса." />
    {loading ? <p role="status">Загрузка настроек…</p> : loadError ? <LoadError message={loadError} onRetry={() => setRetry((value) => value + 1)} /> : course ? (
      <form onSubmit={save} className="max-w-3xl space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <StatusBadge status={course.isPublished ? "published" : "hidden"} />
        <fieldset disabled={busy} className="space-y-4">
          <label className="block text-sm font-medium">Название<input required value={course.title} onChange={(event) => setCourse({ ...course, title: event.target.value })} className="mt-1 block min-h-11 w-full rounded border p-2" /></label>
          <label className="block text-sm font-medium">Описание<textarea required rows={6} value={course.description} onChange={(event) => setCourse({ ...course, description: event.target.value })} className="mt-1 block w-full rounded border p-2" /></label>
          <label className="block text-sm font-medium">Категория<input required value={course.category} onChange={(event) => setCourse({ ...course, category: event.target.value })} className="mt-1 block min-h-11 w-full rounded border p-2" /></label>
          <label className="block text-sm font-medium">Уровень<select value={course.level} onChange={(event) => setCourse({ ...course, level: event.target.value as CourseSettings["level"] })} className="mt-1 block min-h-11 w-full rounded border p-2"><option value="beginner">Начальный</option><option value="intermediate">Средний</option><option value="advanced">Продвинутый</option></select></label>
        </fieldset>
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        {info ? <p role="status" className="text-sm text-emerald-800">{info}</p> : null}
        {dirty ? <p className="text-sm text-amber-800">Есть несохранённые изменения. Сохраните их перед уходом.</p> : null}
        <button disabled={busy || !dirty} className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white disabled:opacity-50">{busy ? "Сохранение…" : "Сохранить настройки"}</button>
      </form>
    ) : null}
  </main>;
}
