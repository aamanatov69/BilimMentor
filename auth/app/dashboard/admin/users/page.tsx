"use client";

import { apiFetch } from "@/lib/api-client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useEffect, useState } from "react";
import { CreateUserModal } from "./create-user-modal";
import { PasswordResetModal } from "./password-reset-modal";
import { RoleModal } from "./role-modal";
import { UserListSection } from "./user-list-section";

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

export default function AdminUsersPage() {
  useEffect(() => {
    const revealLinkedUser = () => {
      if (!window.location.hash.startsWith("#user-")) return;
      setSearchQuery("");
      setRoleFilter("all");
      setStatusFilter("all");
    };
    revealLinkedUser();
    window.addEventListener("hashchange", revealLinkedUser);
    return () => window.removeEventListener("hashchange", revealLinkedUser);
  }, []);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminRole>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "blocked"
  >("all");
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
    try {
      const response = await apiFetch(`${API_URL}/api/admin/users`, {
        credentials: "include",
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
    if (!deleteUserId) {
      return;
    }

    setIsDeletingUser(true);
    setError("");
    try {
      const response = await apiFetch(
        `${API_URL}/api/admin/users/${deleteUserId}`,
        {
          credentials: "include",
          method: "DELETE",
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
    if (!actionUserId || !actionType) {
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
      const response = await apiFetch(
        `${API_URL}/api/admin/users/${actionUserId}/${actionPath}`,
        {
          credentials: "include",
          method: "PATCH",
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
    if (!roleUserId) {
      return;
    }

    setIsSavingRole(true);
    setError("");

    try {
      const response = await apiFetch(`${API_URL}/api/admin/users/${roleUserId}`, {
        credentials: "include",
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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
    if (!passwordUserId) {
      return;
    }

    setIsResettingPassword(true);
    setError("");
    setGeneratedPassword("");

    try {
      const response = await apiFetch(
        `${API_URL}/api/admin/users/${passwordUserId}/password`,
        {
          credentials: "include",
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
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
      const response = await apiFetch(`${API_URL}/api/admin/users`, {
        credentials: "include",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const haystack =
        `${user.fullName} ${user.email} ${user.id}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (roleFilter !== "all" && user.role !== roleFilter) {
      return false;
    }

    if (statusFilter === "active" && user.isBlocked) {
      return false;
    }
    if (statusFilter === "blocked" && !user.isBlocked) {
      return false;
    }

    return true;
  });

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <section className="dashboard-rise relative mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 via-white to-cyan-50 p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Что делать сейчас
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
            Проверьте роли и доступ новых пользователей
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Начните с поиска проблемных аккаунтов, затем обновите роли и
            статусы.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("blocked");
                setRoleFilter("all");
                setSearchQuery("");
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Показать заблокированных ({blockedUsers})
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Создать пользователя
            </button>
          </div>
        </div>
      </section>

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

      <div className="mt-4 grid gap-2 md:grid-cols-[1.4fr_auto_auto]">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по имени, email или ID"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
        />
        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(event.target.value as "all" | AdminRole)
          }
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
        >
          <option value="all">Все роли</option>
          <option value="student">Студенты</option>
          <option value="teacher">Преподаватели</option>
          <option value="admin">Админы</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | "active" | "blocked")
          }
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none"
        >
          <option value="all">Любой статус</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
      </div>

      <UserListSection
        filteredUsers={filteredUsers}
        roleLabels={roleLabels}
        formatLastSeenAt={formatLastSeenAt}
        onOpenRoleModal={openRoleModal}
        onOpenPasswordModal={openPasswordModal}
        onOpenStatusModal={openStatusModal}
        onOpenDeleteModal={openDeleteModal}
      />

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

      <RoleModal
        roleUserId={roleUserId}
        roleUserName={roleUserName}
        newRole={newRole}
        onNewRoleChange={setNewRole}
        isSavingRole={isSavingRole}
        onCancel={closeRoleModal}
        onSave={() => void saveRole()}
      />

      <PasswordResetModal
        passwordUserId={passwordUserId}
        passwordUserName={passwordUserName}
        newPassword={newPassword}
        onNewPasswordChange={setNewPassword}
        generatedPassword={generatedPassword}
        isResettingPassword={isResettingPassword}
        onCancel={closePasswordModal}
        onReset={() => void resetPassword()}
      />

      <CreateUserModal
        isOpen={isCreateModalOpen}
        createFullName={createFullName}
        onCreateFullNameChange={setCreateFullName}
        createEmail={createEmail}
        onCreateEmailChange={setCreateEmail}
        createPhone={createPhone}
        onCreatePhoneChange={setCreatePhone}
        createPassword={createPassword}
        onCreatePasswordChange={setCreatePassword}
        createRole={createRole}
        onCreateRoleChange={setCreateRole}
        createError={createError}
        isCreatingUser={isCreatingUser}
        onCancel={closeCreateModal}
        onCreate={() => void createUser()}
      />
    </main>
  );
}
