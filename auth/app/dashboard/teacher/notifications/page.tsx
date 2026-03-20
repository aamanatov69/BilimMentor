"use client";

import { useEffect, useState } from "react";

import {
  formatNotificationDate,
  localizeNotificationBody,
  localizeNotificationTitle,
  localizeNotificationType,
} from "@/lib/notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const TEACHER_NOTIFICATIONS_SEEN_KEY = "nexoraTeacherNotificationsSeenAt";

type NotificationItem = {
  id: string;
  type:
    | "assignment_deadline"
    | "grade_posted"
    | "new_announcement"
    | "system_message";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export default function TeacherNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");
  const [isMarking, setIsMarking] = useState<string | null>(null);

  const markAsRead = async (id: string) => {
    if (isMarking) return;
    setIsMarking(id);
    try {
      const response = await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (response.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, isRead: true } : item,
          ),
        );
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    } finally {
      setIsMarking(null);
    }
  };

  const markAllAsRead = async () => {
    if (items.every((item) => item.isRead)) return;
    try {
      const response = await fetch(`${API_URL}/api/notifications/read/all`, {
        method: "PATCH",
        credentials: "include",
      });
      if (response.ok) {
        setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch(`${API_URL}/api/notifications`, {
          credentials: "include",
        });
        const data = (await response.json()) as {
          notifications?: NotificationItem[];
          message?: string;
        };
        if (!response.ok) {
          setError(data.message ?? "Не удалось загрузить уведомления");
          return;
        }
        const notifications = data.notifications ?? [];
        setItems(notifications);

        const latestCreatedAt = notifications[0]?.createdAt;
        if (latestCreatedAt) {
          localStorage.setItem(TEACHER_NOTIFICATIONS_SEEN_KEY, latestCreatedAt);
          window.dispatchEvent(new Event("teacher-notifications-seen-updated"));
        }

        // Auto mark all as read after loading
        try {
          await fetch(`${API_URL}/api/notifications/read/all`, {
            method: "PATCH",
            credentials: "include",
          });
          setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
          // Notify layout to update the badge
          window.dispatchEvent(new Event("teacher-notifications-seen-updated"));
        } catch (err) {
          console.error("Error auto-marking notifications as read:", err);
        }
      } catch {
        setError("Ошибка сети при загрузке уведомлений");
      }
    };

    void loadNotifications();
  }, []);

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Уведомления преподавателя</h1>
        {items.some((item) => !item.isRead) && (
          <button
            type="button"
            onClick={() => void markAllAsRead()}
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            Отметить все как прочитанные
          </button>
        )}
      </div>

      {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

      <div
        className={
          items.length > 4
            ? "mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1"
            : "mt-4 space-y-2"
        }
      >
        {items.map((item) => (
          <article
            key={item.id}
            className={`rounded border p-4 transition-colors ${
              item.isRead
                ? "border-slate-100 bg-slate-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {localizeNotificationType(item.type)}
                </p>
                <h2 className="mt-1 font-semibold">
                  {localizeNotificationTitle(item.title)}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {localizeNotificationBody(item.body)}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatNotificationDate(item.createdAt)}
                </p>
              </div>
              {!item.isRead && (
                <button
                  type="button"
                  onClick={() => void markAsRead(item.id)}
                  disabled={isMarking === item.id}
                  className="shrink-0 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isMarking === item.id ? "..." : "Прочитано"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
