import { useLinkedRecord } from "@/lib/use-linked-record";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

type CourseLessonItem = {
  id: string;
  title: string;
  isVisibleToStudents: boolean;
};

type LessonListSectionProps = {
  viewCourseId: string;
  viewCourseTitle: string;
  viewLessons: CourseLessonItem[];
  isLoadingLessons: boolean;
  busyLessonId: string;
  onToggleLessonVisibility: (lesson: CourseLessonItem) => void;
  onOpenDeleteLessonModal: (lessonId: string, lessonTitle: string) => void;
};

export function LessonListSection({
  viewCourseId,
  viewCourseTitle,
  viewLessons,
  isLoadingLessons,
  busyLessonId,
  onToggleLessonVisibility,
  onOpenDeleteLessonModal,
}: LessonListSectionProps) {
  useLinkedRecord(viewLessons.map((lesson) => lesson.id).join("|") + isLoadingLessons);
  return (
    <section className="mt-4 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {viewCourseTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Список уроков выбранного курса.
            </p>
          </div>
          <Link
            href={`/dashboard/teacher/courses/new?courseId=${viewCourseId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap"
          >
            Редактировать курс
          </Link>
        </div>
      </div>

      {isLoadingLessons ? (
        <p className="text-sm text-slate-600">Загрузка уроков...</p>
      ) : viewLessons.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          В этом курсе пока нет уроков.
        </p>
      ) : (
        <div className="space-y-3">
          {viewLessons.map((lesson, index) => (
            <article
              key={lesson.id}
              data-linked-record={`lesson-${lesson.id}`}
              tabIndex={-1}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    {index + 1}. {lesson.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {lesson.isVisibleToStudents
                      ? "Показан студентам"
                      : "Скрыт от студентов"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/teacher/courses/new?courseId=${viewCourseId}&lessonId=${lesson.id}`}
                    className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Редактировать
                  </Link>
                  <button
                    type="button"
                    disabled={busyLessonId === lesson.id}
                    onClick={() => onToggleLessonVisibility(lesson)}
                    className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {lesson.isVisibleToStudents ? "Скрыть" : "Показать"}
                  </button>
                  <button
                    type="button"
                    disabled={busyLessonId === lesson.id}
                    onClick={() =>
                      onOpenDeleteLessonModal(lesson.id, lesson.title)
                    }
                    className="inline-flex items-center justify-center rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Link
        href={`/dashboard/teacher/courses/new?courseId=${viewCourseId}&step=lesson`}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
      >
        <Plus className="h-4 w-4" />
        Добавить урок
      </Link>
    </section>
  );
}
