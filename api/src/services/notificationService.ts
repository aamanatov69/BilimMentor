import { UserRole, NotificationTargetRole } from "@prisma/client";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";
import {
  normalizeLegacyNotification,
  requireCurrentUser,
} from "./shared/serviceHelpers";

export async function listNotifications(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  const targetRole =
    currentUser.role === UserRole.student
      ? NotificationTargetRole.student
      : currentUser.role === UserRole.teacher
        ? NotificationTargetRole.teacher
        : NotificationTargetRole.admin;

  const notifications = await lmsRepository.prisma.notification.findMany({
    where: {
      OR: [{ userId: null }, { userId: currentUser.id }],
      AND: [
        { OR: [{ targetRole: NotificationTargetRole.all }, { targetRole }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    notifications: notifications.map((item) =>
      normalizeLegacyNotification(item),
    ),
  };
}


export async function getUnreadNotificationCount(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  const targetRole =
    currentUser.role === UserRole.student
      ? NotificationTargetRole.student
      : currentUser.role === UserRole.teacher
        ? NotificationTargetRole.teacher
        : NotificationTargetRole.admin;

  const count = await lmsRepository.prisma.notification.count({
    where: {
      OR: [{ userId: null }, { userId: currentUser.id }],
      AND: [
        { OR: [{ targetRole: NotificationTargetRole.all }, { targetRole }] },
        { isRead: false },
      ],
    },
  });

  return { unreadCount: count };
}


export async function markNotificationAsRead(
  userId?: string,
  notificationId?: string,
) {
  const currentUser = await requireCurrentUser(userId);

  ensure(notificationId, 400, "ID уведомления обязателен");

  const notification = await lmsRepository.prisma.notification.findUnique({
    where: { id: notificationId },
  });

  ensure(notification, 404, "Уведомление не найдено");

  // Check if user has access to this notification
  const isGlobalNotification = notification.userId === null;
  const isUserNotification = notification.userId === currentUser.id;
  const hasRoleAccess =
    notification.targetRole === NotificationTargetRole.all ||
    (currentUser.role === UserRole.student &&
      notification.targetRole === NotificationTargetRole.student) ||
    (currentUser.role === UserRole.teacher &&
      notification.targetRole === NotificationTargetRole.teacher) ||
    (currentUser.role === UserRole.admin &&
      notification.targetRole === NotificationTargetRole.admin);

  ensure(
    isGlobalNotification || isUserNotification || hasRoleAccess,
    403,
    "Доступ запрещен",
  );

  const updated = await lmsRepository.prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return { notification: updated };
}


export async function markAllNotificationsAsRead(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  const targetRole =
    currentUser.role === UserRole.student
      ? NotificationTargetRole.student
      : currentUser.role === UserRole.teacher
        ? NotificationTargetRole.teacher
        : NotificationTargetRole.admin;

  const result = await lmsRepository.prisma.notification.updateMany({
    where: {
      OR: [{ userId: null }, { userId: currentUser.id }],
      AND: [
        { OR: [{ targetRole: NotificationTargetRole.all }, { targetRole }] },
        { isRead: false },
      ],
    },
    data: { isRead: true },
  });

  return { updatedCount: result.count };
}

