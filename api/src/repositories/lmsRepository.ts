import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";

// Existing IDs stay valid; new IDs do not depend on database contents.
export const lmsRepository = {
  prisma,
  nextUserId: async () => `u_${randomUUID()}`,
  nextCourseId: async () => `c_${randomUUID()}`,
  nextEnrollmentId: async () => `enr_${randomUUID()}`,
  nextAccessRequestId: async () => `car_${randomUUID()}`,
  nextMessageId: async () => `msg_${randomUUID()}`,
  nextNotificationId: async () => `n_${randomUUID()}`,
};
