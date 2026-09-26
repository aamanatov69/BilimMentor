type LessonMaterialRow = {
  id: string;
  title: string;
  type: string;
  url: string;
  canDelete: boolean;
};

type LessonRow = {
  id: string;
  title: string;
  description: string;
  isVisibleToStudents: boolean;
  materials: LessonMaterialRow[];
};

type LessonsSectionProps = {
  lessons: LessonRow[];
  newLessonTitle: string;
  onNewLessonTitleChange: (value: string) => void;
  newLessonDescription: string;
  onNewLessonDescriptionChange: (value: string) => void;
  creatingLesson: boolean;
  onCreateLesson: (event: React.FormEvent<HTMLFormElement>) => void;
  onUpdateLessonField: (
    lessonId: string,
    field: "title" | "description",
    value: string,
  ) => void;
  savingLessonId: string;
  onSaveLesson: (lesson: LessonRow) => void;
  deletingLessonId: string;
  onDeleteLesson: (lessonId: string) => void;
  deletingMaterialKey: string;
  onDeleteLessonMaterial: (lessonId: string, materialId: string) => void;
};

export function LessonsSection({
  lessons,
  newLessonTitle,
  onNewLessonTitleChange,
  newLessonDescription,
  onNewLessonDescriptionChange,
  creatingLesson,
  onCreateLesson,
  onUpdateLessonField,
  savingLessonId,
  onSaveLesson,
  deletingLessonId,
  onDeleteLesson,
  deletingMaterialKey,
  onDeleteLessonMaterial,
}: LessonsSectionProps) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">Уроки курса</p>

      <form
        onSubmit={onCreateLesson}
        className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
      >
        <input
          value={newLessonTitle}
          onChange={(event) => onNewLessonTitleChange(event.target.value)}
          placeholder="Название нового урока"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={newLessonDescription}
          onChange={(event) => onNewLessonDescriptionChange(event.target.value)}
          placeholder="Описание нового урока"
          className="min-h-20 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={creatingLesson}
          className="w-fit rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
        >
          {creatingLesson ? "Добавление..." : "Добавить урок"}
        </button>
      </form>

      <div className="mt-3 space-y-3">
        {lessons.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Уроков пока нет.
          </p>
        ) : (
          lessons.map((lesson, index) => (
            <article
              key={lesson.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <p className="mb-2 text-xs font-semibold text-slate-500">
                Урок {index + 1}
              </p>
              <input
                value={lesson.title}
                onChange={(event) =>
                  onUpdateLessonField(lesson.id, "title", event.target.value)
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <textarea
                value={lesson.description}
                onChange={(event) =>
                  onUpdateLessonField(
                    lesson.id,
                    "description",
                    event.target.value,
                  )
                }
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>
                  Видимость для студентов:{" "}
                  {lesson.isVisibleToStudents ? "Да" : "Нет"}
                </span>
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-xs font-semibold text-slate-600">
                  Материалы урока
                </p>
                {lesson.materials.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Материалы не добавлены.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {lesson.materials.map((material) => {
                      const requestKey = `${lesson.id}:${material.id}`;
                      const isDeleting = deletingMaterialKey === requestKey;
                      return (
                        <li
                          key={requestKey}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
                        >
                          {material.url ? (
                            <a
                              href={material.url}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 truncate text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900"
                              title="Открыть материал"
                            >
                              {material.title}
                            </a>
                          ) : (
                            <span
                              className="min-w-0 truncate"
                              title={material.title}
                            >
                              {material.title}
                            </span>
                          )}
                          {material.canDelete ? (
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() =>
                                onDeleteLessonMaterial(lesson.id, material.id)
                              }
                              className="shrink-0 whitespace-nowrap rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            >
                              {isDeleting ? "Удаление..." : "Удалить"}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              без ID
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingLessonId === lesson.id}
                  onClick={() => onSaveLesson(lesson)}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {savingLessonId === lesson.id
                    ? "Сохранение..."
                    : "Сохранить урок"}
                </button>
                <button
                  type="button"
                  disabled={deletingLessonId === lesson.id}
                  onClick={() => onDeleteLesson(lesson.id)}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {deletingLessonId === lesson.id
                    ? "Удаление..."
                    : "Удалить урок"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
