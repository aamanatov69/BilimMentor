type PasswordResetModalProps = {
  passwordUserId: string;
  passwordUserName: string;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  generatedPassword: string;
  isResettingPassword: boolean;
  onCancel: () => void;
  onReset: () => void;
};

export function PasswordResetModal({
  passwordUserId,
  passwordUserName,
  newPassword,
  onNewPasswordChange,
  generatedPassword,
  isResettingPassword,
  onCancel,
  onReset,
}: PasswordResetModalProps) {
  if (!passwordUserId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">
          Сбросить пароль пользователя
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          {passwordUserName
            ? `Пользователь: ${passwordUserName}`
            : `ID пользователя: ${passwordUserId}`}
        </p>
        <input
          className="mt-4 w-full rounded border border-slate-300 px-3 py-2"
          placeholder="Новый пароль (опционально)"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          disabled={isResettingPassword}
        />
        {generatedPassword ? (
          <p className="mt-2 text-xs text-slate-600">
            Временный пароль: {generatedPassword}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={onCancel}
            disabled={isResettingPassword}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
            onClick={onReset}
            disabled={isResettingPassword}
          >
            {isResettingPassword ? "Сброс..." : "Сбросить пароль"}
          </button>
        </div>
      </div>
    </div>
  );
}
