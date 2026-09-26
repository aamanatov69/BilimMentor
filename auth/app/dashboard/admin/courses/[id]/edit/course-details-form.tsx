type CourseLevel = "beginner" | "intermediate" | "advanced";

export function getCourseLevelLabel(level: CourseLevel) {
  if (level === "beginner") return "Начальный";
  if (level === "intermediate") return "Средний";
  return "Продвинутый";
}

type CourseDetailsFormProps = {
  title: string;
  onTitleChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  level: CourseLevel;
  onLevelChange: (level: CourseLevel) => void;
  createdAtLocal: string;
  onCreatedAtLocalChange: (value: string) => void;
  isPublished: boolean;
  onIsPublishedChange: (value: boolean) => void;
  publishedLabel: string;
  savingCourse: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CourseDetailsForm({
  title,
  onTitleChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  level,
  onLevelChange,
  createdAtLocal,
  onCreatedAtLocalChange,
  isPublished,
  onIsPublishedChange,
  publishedLabel,
  savingCourse,
  onSubmit,
}: CourseDetailsFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <p className="text-sm font-semibold text-slate-800">Параметры курса</p>

      <div>
        <label className="text-sm text-slate-700">Название</label>
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm text-slate-700">Категория</label>
        <input
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-sm text-slate-700">Описание</label>
        <textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-700">Уровень</label>
          <select
            value={level}
            onChange={(event) => onLevelChange(event.target.value as CourseLevel)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="beginner">{getCourseLevelLabel("beginner")}</option>
            <option value="intermediate">
              {getCourseLevelLabel("intermediate")}
            </option>
            <option value="advanced">{getCourseLevelLabel("advanced")}</option>
          </select>
        </div>

        <div>
          <label className="text-sm text-slate-700">Дата создания курса</label>
          <input
            type="datetime-local"
            value={createdAtLocal}
            onChange={(event) => onCreatedAtLocalChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(event) => onIsPublishedChange(event.target.checked)}
        />
        Статус: {publishedLabel}
      </label>

      <button
        type="submit"
        disabled={savingCourse}
        className="w-fit rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
      >
        {savingCourse ? "Сохранение..." : "Сохранить курс"}
      </button>
    </form>
  );
}
