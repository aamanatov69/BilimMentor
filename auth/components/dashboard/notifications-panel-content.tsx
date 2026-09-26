import {
  formatNotificationDate,
  localizeNotificationBody,
  localizeNotificationTitle,
  localizeNotificationType,
} from "@/lib/notifications";

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
  isRead?: boolean;
};

type NotificationGroups = {
  assignments: NotificationItem[];
  courses: NotificationItem[];
  system: NotificationItem[];
};

type NotificationsPanelContentProps = {
  notifications: NotificationItem[];
  notificationGroups: NotificationGroups;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  listClassName: string;
};

export function NotificationsPanelContent({
  notifications,
  notificationGroups,
  onMarkAsRead,
  onMarkAllRead,
  listClassName,
}: NotificationsPanelContentProps) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Уведомления</p>
        <button
          type="button"
          onClick={onMarkAllRead}
          className="text-xs font-semibold text-sky-700 hover:text-sky-900"
        >
          Отметить все
        </button>
      </div>

      <div className={listClassName}>
        {(["assignments", "courses", "system"] as const).map((groupKey) => {
          const entries = notificationGroups[groupKey];
          if (!entries.length) {
            return null;
          }

          const groupTitle =
            groupKey === "assignments"
              ? "Задания"
              : groupKey === "courses"
                ? "Курсы"
                : "Система";

          return (
            <section key={groupKey}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {groupTitle}
              </p>
              <div className="space-y-1">
                {entries.slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onMarkAsRead(item.id)}
                    className="w-full rounded-xl border border-slate-200 p-2 text-left hover:bg-slate-50"
                  >
                    <p className="text-xs font-semibold text-slate-900">
                      {localizeNotificationTitle(item.title)}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                      {localizeNotificationBody(item.body)}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {localizeNotificationType(item.type)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatNotificationDate(item.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {!notifications.length ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Уведомлений пока нет
          </p>
        ) : null}
      </div>
    </>
  );
}
