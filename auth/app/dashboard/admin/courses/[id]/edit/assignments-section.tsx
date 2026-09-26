type LessonRow = {
  id: string;
  title: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  lessonId: string;
  lessonTitle: string;
  dueAtLocal: string;
};

type AssignmentsSectionProps = {
  assignments: AssignmentRow[];
  lessons: LessonRow[];
  onUpdateAssignmentField: (
    assignmentId: string,
    field: "title" | "description" | "dueAtLocal" | "lessonId",
    value: string,
  ) => void;
  savingAssignmentId: string;
  onSaveAssignment: (assignment: AssignmentRow) => void;
  deletingAssignmentId: string;
  onDeleteAssignment: (assignmentId: string) => void;
};

export function AssignmentsSection({
  assignments,
  lessons,
  onUpdateAssignmentField,
  savingAssignmentId,
  onSaveAssignment,
  deletingAssignmentId,
  onDeleteAssignment,
}: AssignmentsSectionProps) {
  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-800">Задания курса</p>

      <div className="mt-3 space-y-3">
        {assignments.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Заданий пока нет.
          </p>
        ) : (
          assignments.map((assignment) => (
            <article
              key={assignment.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <input
                value={assignment.title}
                onChange={(event) =>
                  onUpdateAssignmentField(
                    assignment.id,
                    "title",
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <textarea
                value={assignment.description}
                onChange={(event) =>
                  onUpdateAssignmentField(
                    assignment.id,
                    "description",
                    event.target.value,
                  )
                }
                className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-slate-600">Урок</label>
                  <select
                    value={assignment.lessonId}
                    onChange={(event) =>
                      onUpdateAssignmentField(
                        assignment.id,
                        "lessonId",
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600">Дедлайн</label>
                  <input
                    type="datetime-local"
                    value={assignment.dueAtLocal}
                    onChange={(event) =>
                      onUpdateAssignmentField(
                        assignment.id,
                        "dueAtLocal",
                        event.target.value,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={savingAssignmentId === assignment.id}
                  onClick={() => onSaveAssignment(assignment)}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {savingAssignmentId === assignment.id
                    ? "Сохранение..."
                    : "Сохранить задание"}
                </button>
                <button
                  type="button"
                  disabled={deletingAssignmentId === assignment.id}
                  onClick={() => onDeleteAssignment(assignment.id)}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {deletingAssignmentId === assignment.id
                    ? "Удаление..."
                    : "Удалить задание"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
