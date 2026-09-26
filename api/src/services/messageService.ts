import { lmsRepository } from "../repositories/lmsRepository";
import { ensure } from "../utils/httpError";
import {
  isUserRole,
  canMessageBetween,
  userPublic,
  requireCurrentUser,
} from "./shared/serviceHelpers";

export async function listUsersForMessaging(
  userId?: string,
  requestedRole?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  const roleFilter =
    typeof requestedRole === "string" && isUserRole(requestedRole)
      ? requestedRole
      : undefined;

  const candidates = await lmsRepository.prisma.user.findMany({
    where: { id: { not: currentUser.id } },
    select: { id: true, fullName: true, email: true, role: true },
    orderBy: { fullName: "asc" },
  });

  let visibleUsers = candidates.filter((item) =>
    canMessageBetween(currentUser.role, item.role),
  );
  if (roleFilter) {
    visibleUsers = visibleUsers.filter((item) => item.role === roleFilter);
  }

  return { users: visibleUsers.map((item) => userPublic(item)) };
}


export async function listMessages(
  userId?: string,
  withUserId?: string,
  withRole?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  const normalizedRole =
    typeof withRole === "string" && isUserRole(withRole) ? withRole : undefined;

  const conversation = await lmsRepository.prisma.message.findMany({
    where: {
      OR: [{ fromUserId: currentUser.id }, { toUserId: currentUser.id }],
    },
    orderBy: { createdAt: "asc" },
    include: {
      fromUser: { select: { id: true, role: true } },
      toUser: { select: { id: true, role: true } },
    },
  });

  const filtered = conversation.filter((item) => {
    const otherUser =
      item.fromUserId === currentUser.id ? item.toUser : item.fromUser;
    if (withUserId && otherUser.id !== withUserId) {
      return false;
    }
    if (normalizedRole && otherUser.role !== normalizedRole) {
      return false;
    }
    if (
      !canMessageBetween(currentUser.role, otherUser.role) &&
      !canMessageBetween(otherUser.role, currentUser.role)
    ) {
      return false;
    }
    return true;
  });

  return {
    messages: filtered.map((item) => ({
      id: item.id,
      fromUserId: item.fromUserId,
      toUserId: item.toUserId,
      text: item.text,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}


export async function sendMessage(
  userId: string | undefined,
  input: { toUserId?: string; message?: string; text?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  const normalizedMessage = (input.message ?? input.text ?? "").trim();
  ensure(input.toUserId && normalizedMessage, 400, "Операция недоступна");

  const recipient = await lmsRepository.prisma.user.findUnique({
    where: { id: input.toUserId },
  });
  ensure(recipient, 404, "Ресурс не найден");
  ensure(
    canMessageBetween(currentUser.role, recipient.role),
    403,
    "Операция недоступна",
  );

  const created = await lmsRepository.prisma.message.create({
    data: {
      id: await lmsRepository.nextMessageId(),
      fromUserId: currentUser.id,
      toUserId: recipient.id,
      text: normalizedMessage,
    },
  });

  return {
    message: {
      id: created.id,
      fromUserId: created.fromUserId,
      toUserId: created.toUserId,
      text: created.text,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

