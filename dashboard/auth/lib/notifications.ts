type NotificationType =
  | "assignment_deadline"
  | "grade_posted"
  | "new_announcement"
  | "system_message";

const typeLabels: Record<NotificationType, string> = {
  assignment_deadline: "Дедлайн задания",
  grade_posted: "Оценка опубликована",
  new_announcement: "Новое объявление",
  system_message: "Системное сообщение",
};

export function localizeNotificationType(type: NotificationType) {
  return typeLabels[type] ?? "Уведомление";
}

export function localizeNotificationTitle(title: string) {
  if (title === "System notification") {
    return "Системное уведомление";
  }
  return title;
}

export function localizeNotificationBody(body: string) {
  const normalizedBody = body.trim();
  if (
    normalizedBody === "Action completed" ||
    normalizedBody === "Action completed."
  ) {
    return "Действие выполнено";
  }
  return body;
}

export function formatNotificationDate(createdAt: string) {
  return new Date(createdAt).toLocaleString("ru-RU");
}
