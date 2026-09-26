import { useLinkedRecord } from "@/lib/use-linked-record";
type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  role: "student" | "teacher" | "admin";
  isBlocked: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
};

type UserAction = "block" | "unblock";

type UserListSectionProps = {
  filteredUsers: AdminUser[];
  roleLabels: Record<AdminUser["role"], string>;
  formatLastSeenAt: (value: string | null) => string;
  onOpenRoleModal: (user: AdminUser) => void;
  onOpenPasswordModal: (user: AdminUser) => void;
  onOpenStatusModal: (
    userId: string,
    fullName: string,
    action: UserAction,
  ) => void;
  onOpenDeleteModal: (userId: string, fullName: string) => void;
};

export function UserListSection({
  filteredUsers,
  roleLabels,
  formatLastSeenAt,
  onOpenRoleModal,
  onOpenPasswordModal,
  onOpenStatusModal,
  onOpenDeleteModal,
}: UserListSectionProps) {
  useLinkedRecord(filteredUsers.map((user) => user.id).join("|"));
  return (
    <>
      <div className="mt-4 space-y-3 lg:hidden">
        {filteredUsers.length ? (
          filteredUsers.map((user) => (
            <article
              key={`mobile-${user.id}`}
              data-linked-record={`user-${user.id}`}
              tabIndex={-1}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{user.fullName}</p>
                  <p className="text-xs text-slate-500">ID: {user.id}</p>
                  <p className="mt-1 break-all text-sm text-slate-600">
                    {user.email}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                  {roleLabels[user.role]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={
                    user.isBlocked
                      ? "rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700"
                      : "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700"
                  }
                >
                  {user.isBlocked ? "Заблокирован" : "Активен"}
                </span>
                <span
                  className={
                    user.isOnline
                      ? "rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700"
                      : "rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                  }
                >
                  {user.isOnline ? "В сети" : "Не в сети"}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Последний визит: {formatLastSeenAt(user.lastSeenAt)}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => onOpenRoleModal(user)}
                >
                  Изменить роль
                </button>
                <button
                  type="button"
                  className="rounded border border-blue-300 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  onClick={() => onOpenPasswordModal(user)}
                >
                  Сбросить пароль
                </button>
                <button
                  type="button"
                  className={
                    user.isBlocked
                      ? "rounded border border-emerald-300 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                      : "rounded border border-amber-300 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50"
                  }
                  onClick={() =>
                    onOpenStatusModal(
                      user.id,
                      user.fullName,
                      user.isBlocked ? "unblock" : "block",
                    )
                  }
                >
                  {user.isBlocked ? "Разблокировать" : "Заблокировать"}
                </button>
                <button
                  type="button"
                  className="rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  onClick={() => onOpenDeleteModal(user.id, user.fullName)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            По текущим фильтрам пользователи не найдены. Измените фильтры или
            очистите поиск.
          </p>
        )}
      </div>

      <div className="mobile-scroll mt-4 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 pl-3 font-medium">
                Идентификатор
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                Имя
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                Электронная почта
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                Роль
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                Статус
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                В сети
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                Последний визит
              </th>
              <th className="border-b border-slate-200 bg-slate-50 py-3 pr-3 font-medium">
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr data-linked-record={`user-${user.id}`} tabIndex={-1} key={user.id} className="odd:bg-white even:bg-slate-50/40">
                <td className="border-b border-slate-100 py-3 pr-3 pl-3 text-slate-600">
                  {user.id}
                </td>
                <td className="py-3 pr-3">{user.fullName}</td>
                <td className="py-3 pr-3">{user.email}</td>
                <td className="py-3 pr-3">{roleLabels[user.role]}</td>
                <td className="border-b border-slate-100 py-3 pr-3">
                  {user.isBlocked ? (
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">
                      Заблокирован
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                      Активен
                    </span>
                  )}
                </td>
                <td className="border-b border-slate-100 py-3 pr-3">
                  {user.isOnline ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                      В сети
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      Не в сети
                    </span>
                  )}
                </td>
                <td className="border-b border-slate-100 py-3 pr-3 text-slate-600">
                  {formatLastSeenAt(user.lastSeenAt)}
                </td>
                <td className="border-b border-slate-100 py-3 pr-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => onOpenRoleModal(user)}
                    >
                      Изменить роль
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      onClick={() => onOpenDeleteModal(user.id, user.fullName)}
                    >
                      Удалить
                    </button>
                    {user.isBlocked ? (
                      <button
                        type="button"
                        className="rounded border border-emerald-300 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                        onClick={() =>
                          onOpenStatusModal(user.id, user.fullName, "unblock")
                        }
                      >
                        Разблокировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-amber-300 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50"
                        onClick={() =>
                          onOpenStatusModal(user.id, user.fullName, "block")
                        }
                      >
                        Заблокировать
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded border border-blue-300 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                      onClick={() => onOpenPasswordModal(user)}
                    >
                      Сбросить пароль
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredUsers.length ? (
          <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            По текущим фильтрам пользователи не найдены. Измените фильтры или
            очистите поиск.
          </p>
        ) : null}
      </div>
    </>
  );
}
