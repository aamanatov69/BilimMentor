"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
type AdminRole = AdminUser["role"];

function getTokenFromCookie() {
  const tokenCookie = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("nexoraToken="));

  return tokenCookie ? decodeURIComponent(tokenCookie.split("=")[1]) : "";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteUserName, setDeleteUserName] = useState("");
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [actionUserId, setActionUserId] = useState("");
  const [actionUserName, setActionUserName] = useState("");
  const [actionType, setActionType] = useState<UserAction | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [roleUserId, setRoleUserId] = useState("");
  const [roleUserName, setRoleUserName] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("student");
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState("");
  const [passwordUserName, setPasswordUserName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFullName, setCreateFullName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<AdminRole>("student");
  const [createError, setCreateError] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const formatLastSeenAt = (value: string | null) => {
    if (!value) {
      return "Нет данных";
    }

    return new Date(value).toLocaleString("ru-RU");
  };

  const loadUsers = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setError("Требуется авторизация");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = (await response.json()) as {
        users?: AdminUser[];
        message?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось загрузить пользователей");
        return;
      }

      setUsers(
        [...(data.users ?? [])].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, "ru-RU", {
            sensitivity: "base",
          }),
        ),
      );
    } catch {
      setError("Ошибка сети");
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const openDeleteModal = (userId: string, fullName: string) => {
    setDeleteUserId(userId);
    setDeleteUserName(fullName);
    setError("");
  };

  const closeDeleteModal = () => {
    if (isDeletingUser) {
      return;
    }
    setDeleteUserId("");
    setDeleteUserName("");
  };

  const deleteUser = async () => {
    const token = getTokenFromCookie();
    if (!token || !deleteUserId) {
      setError("Требуется авторизация");
      return;
    }

    setIsDeletingUser(true);
    setError("");
    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${deleteUserId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Не удалось удалить пользователя");
        return;
      }

      setDeleteUserId("");
      setDeleteUserName("");
      await loadUsers();
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openStatusModal = (
    userId: string,
    fullName: string,
    action: UserAction,
  ) => {
    setActionUserId(userId);
    setActionUserName(fullName);
    setActionType(action);
    setError("");
  };

  const closeStatusModal = () => {
    if (isChangingStatus) {
      return;
    }
    setActionUserId("");
    setActionUserName("");
    setActionType(null);
  };

  const changeUserStatus = async () => {
    const token = getTokenFromCookie();
    if (!token || !actionUserId || !actionType) {
      setError("Требуется авторизация");
      return;
    }

    const actionPath = actionType === "block" ? "block" : "unblock";
    const failedActionText =
      actionType === "block"
        ? "Не удалось заблокировать пользователя"
        : "Не удалось разблокировать пользователя";

    setIsChangingStatus(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${actionUserId}/${actionPath}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? failedActionText);
        return;
      }

      setActionUserId("");
      setActionUserName("");
      setActionType(null);
      await loadUsers();
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsChangingStatus(false);
    }
  };

  const openRoleModal = (user: AdminUser) => {
    setRoleUserId(user.id);
    setRoleUserName(user.fullName);
    setNewRole(user.role);
    setError("");
  };

  const closeRoleModal = () => {
    if (isSavingRole) {
      return;
    }
    setRoleUserId("");
    setRoleUserName("");
  };

  const saveRole = async () => {
    const token = getTokenFromCookie();
    if (!token || !roleUserId) {
      setError("Требуется авторизация");
      return;
    }

    setIsSavingRole(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users/${roleUserId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "Не удалось изменить роль");
        return;
      }

      setRoleUserId("");
      setRoleUserName("");
      await loadUsers();
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsSavingRole(false);
    }
  };

  const openPasswordModal = (user: AdminUser) => {
    setPasswordUserId(user.id);
    setPasswordUserName(user.fullName);
    setNewPassword("");
    setGeneratedPassword("");
    setError("");
  };

  const closePasswordModal = () => {
    if (isResettingPassword) {
      return;
    }
    setPasswordUserId("");
    setPasswordUserName("");
    setNewPassword("");
    setGeneratedPassword("");
  };

  const resetPassword = async () => {
    const token = getTokenFromCookie();
    if (!token || !passwordUserId) {
      setError("Требуется авторизация");
      return;
    }

    setIsResettingPassword(true);
    setError("");
    setGeneratedPassword("");

    try {
      const response = await fetch(
        `${API_URL}/api/admin/users/${passwordUserId}/password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password: newPassword }),
        },
      );

      const data = (await response.json()) as {
        message?: string;
        temporaryPassword?: string;
      };

      if (!response.ok) {
        setError(data.message ?? "Не удалось сбросить пароль");
        return;
      }

      setGeneratedPassword(data.temporaryPassword ?? "");
      setNewPassword("");
    } catch {
      setError("Ошибка сети");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    setCreateFullName("");
    setCreateEmail("");
    setCreatePhone("");
    setCreatePassword("");
    setCreateRole("student");
    setCreateError("");
    setError("");
  };

  const closeCreateModal = () => {
    if (isCreatingUser) {
      return;
    }
    setIsCreateModalOpen(false);
    setCreateError("");
  };

  const createUser = async () => {
    const token = getTokenFromCookie();
    if (!token) {
      setCreateError("Требуется авторизация");
      return;
    }

    const fullName = createFullName.trim();
    const email = createEmail.trim();
    const phone = createPhone.trim();
    const password = createPassword.trim();

    if (!fullName || !email || !phone || !password) {
      setCreateError("Заполните имя, email, телефон и пароль");
      return;
    }

    setIsCreatingUser(true);
    setCreateError("");
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password,
          role: createRole,
        }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setCreateError(data.message ?? "Не удалось создать пользователя");
        return;
      }

      setIsCreateModalOpen(false);
      await loadUsers();
    } catch {
      setCreateError("Ошибка сети");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const roleLabels: Record<AdminUser["role"], string> = {
    student: "Студент",
    teacher: "Преподаватель",
    admin: "Администратор",
  };

  const onlineUsers = users.filter((user) => user.isOnline).length;
  const blockedUsers = users.filter((user) => user.isBlocked).length;

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">
            Управление пользователями
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Управление ролями, доступом и состоянием аккаунтов.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="w-full rounded bg-blue-700 px-3 py-2 text-center text-sm text-white hover:bg-blue-800 sm:w-auto"
        >
          Создать пользователя
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p className="text-slate-500">Всего пользователей</p>
          <p className="text-lg font-semibold text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <p className="text-emerald-700">Сейчас в сети</p>
          <p className="text-lg font-semibold text-emerald-800">
            {onlineUsers}
          </p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
          <p className="text-rose-700">Заблокированы</p>
          <p className="text-lg font-semibold text-rose-800">{blockedUsers}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 lg:hidden">
        {users.map((user) => (
          <article
            key={`mobile-${user.id}`}
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
                onClick={() => openRoleModal(user)}
              >
                Изменить роль
              </button>
              <button
                type="button"
                className="rounded border border-blue-300 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                onClick={() => openPasswordModal(user)}
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
                  openStatusModal(
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
                onClick={() => openDeleteModal(user.id, user.fullName)}
              >
                Удалить
              </button>
            </div>
          </article>
        ))}
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
            {users.map((user) => (
              <tr key={user.id} className="odd:bg-white even:bg-slate-50/40">
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
                      onClick={() => openRoleModal(user)}
                    >
                      Изменить роль
                    </button>
                    <button
                      type="button"
                      className="rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      onClick={() => openDeleteModal(user.id, user.fullName)}
                    >
                      Удалить
                    </button>
                    {user.isBlocked ? (
                      <button
                        type="button"
                        className="rounded border border-emerald-300 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                        onClick={() =>
                          openStatusModal(user.id, user.fullName, "unblock")
                        }
                      >
                        Разблокировать
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-amber-300 px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50"
                        onClick={() =>
                          openStatusModal(user.id, user.fullName, "block")
                        }
                      >
                        Заблокировать
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded border border-blue-300 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-50"
                      onClick={() => openPasswordModal(user)}
                    >
                      Сбросить пароль
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteUserId)}
        title="Удалить пользователя?"
        description={
          deleteUserName
            ? `Пользователь \"${deleteUserName}\" будет удален без возможности восстановления.`
            : "Пользователь будет удален без возможности восстановления."
        }
        confirmText="Подтвердить"
        cancelText="Отмена"
        isBusy={isDeletingUser}
        onCancel={closeDeleteModal}
        onConfirm={() => void deleteUser()}
      />

      <ConfirmModal
        isOpen={Boolean(actionUserId && actionType)}
        title={
          actionType === "block"
            ? "Заблокировать пользователя?"
            : "Разблокировать пользователя?"
        }
        description={
          actionType === "block"
            ? actionUserName
              ? `Пользователь "${actionUserName}" будет заблокирован. Его исходный пароль останется без изменений.`
              : "Пользователь будет заблокирован. Его исходный пароль останется без изменений."
            : actionUserName
              ? `Пользователь "${actionUserName}" будет разблокирован. Его исходный пароль останется без изменений.`
              : "Пользователь будет разблокирован. Его исходный пароль останется без изменений."
        }
        confirmText={
          actionType === "block" ? "Заблокировать" : "Разблокировать"
        }
        cancelText="Отмена"
        tone={actionType === "block" ? "danger" : "default"}
        isBusy={isChangingStatus}
        onCancel={closeStatusModal}
        onConfirm={() => void changeUserStatus()}
      />

      {roleUserId ? (
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
              onChange={(event) => setNewRole(event.target.value as AdminRole)}
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
                onClick={closeRoleModal}
                disabled={isSavingRole}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
                onClick={() => void saveRole()}
                disabled={isSavingRole}
              >
                {isSavingRole ? "Сохранение..." : "Сохранить роль"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordUserId ? (
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
              onChange={(event) => setNewPassword(event.target.value)}
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
                onClick={closePasswordModal}
                disabled={isResettingPassword}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
                onClick={() => void resetPassword()}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? "Сброс..." : "Сбросить пароль"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCreateModalOpen ? (
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
                onChange={(event) => setCreateFullName(event.target.value)}
                disabled={isCreatingUser}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder="Email"
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
                disabled={isCreatingUser}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder="Телефон"
                value={createPhone}
                onChange={(event) => setCreatePhone(event.target.value)}
                disabled={isCreatingUser}
              />
              <input
                className="w-full rounded border border-slate-300 px-3 py-2"
                placeholder="Пароль"
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
                disabled={isCreatingUser}
                type="password"
              />
              <select
                className="w-full rounded border border-slate-300 px-3 py-2"
                value={createRole}
                onChange={(event) =>
                  setCreateRole(event.target.value as AdminRole)
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
                onClick={closeCreateModal}
                disabled={isCreatingUser}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800 disabled:opacity-60"
                onClick={() => void createUser()}
                disabled={isCreatingUser}
              >
                {isCreatingUser ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
