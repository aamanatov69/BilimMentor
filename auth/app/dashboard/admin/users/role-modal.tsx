type AdminRole = "student" | "teacher" | "admin";

type RoleModalProps = {
  roleUserId: string;
  roleUserName: string;
  newRole: AdminRole;
  onNewRoleChange: (role: AdminRole) => void;
  isSavingRole: boolean;
  onCancel: () => void;
  onSave: () => void;
};

export function RoleModal({
  roleUserId,
  roleUserName,
  newRole,
  onNewRoleChange,
  isSavingRole,
  onCancel,
  onSave,
}: RoleModalProps) {
  if (!roleUserId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">
          Изменить роль пользователя
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {roleUserName
            ? `Пользователь: ${roleUserName}`
            : `ID пользователя: ${roleUserId}`}
        </p>
        <select
          className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
          value={newRole}
          onChange={(event) => onNewRoleChange(event.target.value as AdminRole)}
          disabled={isSavingRole}
        >
          <option value="student">Студент</option>
          <option value="teacher">Преподаватель</option>
          <option value="admin">Администратор</option>
        </select>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={onCancel}
            disabled={isSavingRole}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
            onClick={onSave}
            disabled={isSavingRole}
          >
            {isSavingRole ? "Сохранение..." : "Сохранить роль"}
          </button>
        </div>
      </div>
    </div>
  );
}
