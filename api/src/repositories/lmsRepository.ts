import { prisma } from "../lib/prisma";

async function nextPrefixedId(prefix: string, ids: string[]) {
  const maxNumericId = ids.reduce((maximum, id) => {
    const value = Number.parseInt(id.replace(new RegExp(`^${prefix}`), ""), 10);
    if (Number.isNaN(value)) {
      return maximum;
    }
    return Math.max(maximum, value);
  }, 0);
  return `${prefix}${maxNumericId + 1}`;
}

async function nextId(
  prefix: string,
  model:
    | "user"
    | "course"
    | "enrollment"
    | "accessRequest"
    | "message"
    | "notification",
) {
  if (model === "user") {
    const existing = await prisma.user.findMany({ select: { id: true } });
    return nextPrefixedId(
      prefix,
      existing.map((item) => item.id),
    );
  }

  if (model === "course") {
    const existing = await prisma.course.findMany({ select: { id: true } });
    return nextPrefixedId(
      prefix,
      existing.map((item) => item.id),
    );
  }

  if (model === "enrollment") {
    const existing = await prisma.enrollment.findMany({ select: { id: true } });
    return nextPrefixedId(
      prefix,
      existing.map((item) => item.id),
    );
  }

  if (model === "accessRequest") {
    const existing = await prisma.accessRequest.findMany({
      select: { id: true },
    });
    return nextPrefixedId(
      prefix,
      existing.map((item) => item.id),
    );
  }

  if (model === "message") {
    const existing = await prisma.message.findMany({ select: { id: true } });
    return nextPrefixedId(
      prefix,
      existing.map((item) => item.id),
    );
  }

  const existing = await prisma.notification.findMany({ select: { id: true } });
  return nextPrefixedId(
    prefix,
    existing.map((item) => item.id),
  );
}

export const lmsRepository = {
  prisma,
  nextUserId: () => nextId("u", "user"),
  nextCourseId: () => nextId("c", "course"),
  nextEnrollmentId: () => nextId("enr", "enrollment"),
  nextAccessRequestId: () => nextId("car", "accessRequest"),
  nextMessageId: () => nextId("msg", "message"),
  nextNotificationId: () => nextId("n", "notification"),
};
