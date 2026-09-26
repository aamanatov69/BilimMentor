type AdminRole = "student" | "teacher" | "admin";

type CreateUserModalProps = {
  isOpen: boolean;
  createFullName: string;
  onCreateFullNameChange: (value: string) => void;
  createEmail: string;
  onCreateEmailChange: (value: string) => void;
  createPhone: string;
  onCreatePhoneChange: (value: string) => void;
  createPassword: string;
  onCreatePasswordChange: (value: string) => void;
  createRole: AdminRole;
  onCreateRoleChange: (role: AdminRole) => void;
  createError: string;
  isCreatingUser: boolean;
  onCancel: () => void;
  onCreate: () => void;
};

export function CreateUserModal({
  isOpen,
  createFullName,
  onCreateFullNameChange,
  createEmail,
  onCreateEmailChange,
  createPhone,
  onCreatePhoneChange,
  createPassword,
  onCreatePasswordChange,
  createRole,
  onCreateRoleChange,
  createError,
  isCreatingUser,
  onCancel,
  onCreate,
}: CreateUserModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">
          Создать пользователя
        </h3>

        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="ФИО"
            value={createFullName}
            onChange={(event) => onCreateFullNameChange(event.target.value)}
            disabled={isCreatingUser}
          />
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Email"
            value={createEmail}
            onChange={(event) => onCreateEmailChange(event.target.value)}
            disabled={isCreatingUser}
          />
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Телефон"
            value={createPhone}
            onChange={(event) => onCreatePhoneChange(event.target.value)}
            disabled={isCreatingUser}
          />
          <input
            className="w-full rounded border border-slate-300 px-3 py-2"
            placeholder="Пароль"
            value={createPassword}
            onChange={(event) => onCreatePasswordChange(event.target.value)}
            disabled={isCreatingUser}
            type="password"
          />
          <select
            className="w-full rounded border border-slate-300 px-3 py-2"
            value={createRole}
            onChange={(event) =>
              onCreateRoleChange(event.target.value as AdminRole)
            }
            disabled={isCreatingUser}
          >
            <option value="student">Студент</option>
            <option value="teacher">Преподаватель</option>
            <option value="admin">Администратор</option>
          </select>
        </div>

        {createError ? (
          <p className="mt-3 text-sm text-rose-600">{createError}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={onCancel}
            disabled={isCreatingUser}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
            onClick={onCreate}
            disabled={isCreatingUser}
          >
            {isCreatingUser ? "Создание..." : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
