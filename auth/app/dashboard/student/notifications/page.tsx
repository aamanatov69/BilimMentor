"use client";

import { useEffect, useState } from "react";

import {
  formatNotificationDate,
  localizeNotificationBody,
  localizeNotificationTitle,
  localizeNotificationType,
} from "@/lib/notifications";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const STUDENT_NOTIFICATIONS_SEEN_KEY = "nexoraStudentNotificationsSeenAt";

type NotificationItem = {
  id: string;
  type:
    | "assignment_deadline"
    | "grade_posted"
    | "new_announcement"
    | "system_message";
  title: string;
  body: string;
  createdAt: string;
};

export default function StudentNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState("");

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
          localStorage.setItem(STUDENT_NOTIFICATIONS_SEEN_KEY, latestCreatedAt);
          window.dispatchEvent(new Event("student-notifications-seen-updated"));
        }
      } catch {
        setError("Ошибка сети при загрузке уведомлений");
      }
    };

    void loadNotifications();
  }, []);

  return (
    <main className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h1 className="text-2xl font-semibold">Уведомления</h1>
      <p className="mt-2 text-slate-600">
        Типы: дедлайны заданий, публикации оценок, новые объявления, системные
        сообщения.
      </p>

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
            className="rounded border border-slate-200 p-4"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {localizeNotificationType(item.type)}
            </p>
            <h2 className="mt-1 break-words font-semibold">
              {localizeNotificationTitle(item.title)}
            </h2>
            <p className="mt-1 break-words text-sm text-slate-600">
              {localizeNotificationBody(item.body)}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {formatNotificationDate(item.createdAt)}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
