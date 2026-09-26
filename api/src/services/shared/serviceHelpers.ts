import { UserRole, CourseLevel, AccessRequestStatus, NotificationTargetRole, NotificationType } from "@prisma/client";
import crypto from "crypto";
import { lmsRepository } from "../../repositories/lmsRepository";
import { ensure } from "../../utils/httpError";

export function isUserRole(value: unknown): value is UserRole {
  return (
    value === UserRole.student ||
    value === UserRole.teacher ||
    value === UserRole.admin
  );
}


export function isCourseLevel(value: unknown): value is CourseLevel {
  return (
    value === CourseLevel.beginner ||
    value === CourseLevel.intermediate ||
    value === CourseLevel.advanced
  );
}


export function isAccessRequestStatus(value: unknown): value is AccessRequestStatus {
  return (
    value === AccessRequestStatus.pending ||
    value === AccessRequestStatus.approved ||
    value === AccessRequestStatus.rejected
  );
}


export function canMessageBetween(fromRole: UserRole, toRole: UserRole) {
  if (fromRole === UserRole.student && toRole === UserRole.teacher) {
    return true;
  }
  if (
    fromRole === UserRole.teacher &&
    (toRole === UserRole.student || toRole === UserRole.admin)
  ) {
    return true;
  }
  if (fromRole === UserRole.admin && toRole === UserRole.teacher) {
    return true;
  }
  return false;
}


export const ONLINE_WINDOW_MS = 5 * 60 * 1000;


export function isUserOnline(lastSeenAt?: Date | null) {
  if (!lastSeenAt) {
    return false;
  }
  return Date.now() - lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
}


export function userPublic(user: {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isBlocked?: boolean;
  lastSeenAt?: Date | null;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isBlocked: Boolean(user.isBlocked),
    isOnline: isUserOnline(user.lastSeenAt),
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
  };
}


export function normalizeLegacyNotification<
  T extends {
    type: NotificationType;
    title: string;
    body: string;
  },
>(notification: T): T {
  const isGenericTitle =
    notification.title === "Системное уведомление" ||
    notification.title === "Enabled" ||
    notification.title === "Disabled";
  const isGenericBody =
    notification.body === "Действие выполнено" ||
    notification.body === "Действие выполнено.";

  if (!isGenericTitle && !isGenericBody) {
    return notification;
  }

  if (notification.type === NotificationType.new_announcement) {
    return {
      ...notification,
      title: "Новое объявление",
      body: "Опубликовано новое объявление или обновление курса.",
    };
  }

  if (notification.type === NotificationType.grade_posted) {
    return {
      ...notification,
      title: "Оценка опубликована",
      body: "Преподаватель опубликовал оценку по одной из ваших работ.",
    };
  }

  if (notification.type === NotificationType.assignment_deadline) {
    return {
      ...notification,
      title: "Дедлайн задания",
      body: "Добавлено новое задание или обновлен срок его сдачи.",
    };
  }

  return {
    ...notification,
    title: "Системное сообщение",
    body: "Выполнено системное действие. Откройте связанный раздел для деталей.",
  };
}


export function readModules(modules: unknown) {
  return Array.isArray(modules) ? modules : [];
}


export type StudentLessonProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  completedLessonIds: string[];
};


export function makeEntityId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}


export function asModuleRecordArray(modules: unknown) {
  return readModules(modules).filter((item): item is Record<string, unknown> =>
    isRecord(item),
  );
}


export function readVisibleLessonIds(modules: unknown) {
  return asModuleRecordArray(modules)
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        asString(item.type).toLowerCase() === "lesson" &&
        item.isVisibleToStudents !== false,
    )
    .map(
      ({ item, index }) => asString(item.id).trim() || `lesson-${index + 1}`,
    );
}


export function calculateProgressPercent(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}


export async function getStudentLessonProgress(params: {
  courseId: string;
  studentId: string;
  modules: unknown;
}): Promise<StudentLessonProgressSummary> {
  const lessonIds = readVisibleLessonIds(params.modules);
  if (!lessonIds.length) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      progressPercent: 0,
      completedLessonIds: [],
    };
  }

  const completed = await lmsRepository.prisma.studentLessonProgress.findMany({
    where: {
      courseId: params.courseId,
      studentId: params.studentId,
      lessonId: { in: lessonIds },
    },
    select: { lessonId: true },
  });

  const completedSet = new Set(completed.map((item) => item.lessonId));
  const completedLessonIds = lessonIds.filter((lessonId) =>
    completedSet.has(lessonId),
  );
  const completedLessons = completedLessonIds.length;

  return {
    totalLessons: lessonIds.length,
    completedLessons,
    progressPercent: calculateProgressPercent(
      completedLessons,
      lessonIds.length,
    ),
    completedLessonIds,
  };
}


export function findLessonIndex(modules: Record<string, unknown>[], lessonId: string) {
  return modules.findIndex(
    (item) =>
      asString(item.type).toLowerCase() === "lesson" &&
      asString(item.id) === lessonId,
  );
}


export function isAssignmentVisibleToStudents(
  courseModules: unknown,
  lessonId?: string | null,
) {
  const normalizedLessonId = asString(lessonId).trim();
  if (!normalizedLessonId) {
    return true;
  }

  const modules = asModuleRecordArray(courseModules);
  const lessonIndex = findLessonIndex(modules, normalizedLessonId);
  if (lessonIndex < 0) {
    return false;
  }

  const lesson = modules[lessonIndex];
  return lesson.isVisibleToStudents !== false;
}


export function readLessonTitleById(courseModules: unknown, lessonId?: string | null) {
  const normalizedLessonId = asString(lessonId).trim();
  if (!normalizedLessonId) {
    return null;
  }

  const modules = asModuleRecordArray(courseModules);
  const lessonIndex = findLessonIndex(modules, normalizedLessonId);
  if (lessonIndex < 0) {
    return null;
  }

  const title = asString(modules[lessonIndex]?.title).trim();
  return title || null;
}


export function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}


export function stripMathTypeTokens(value: string) {
  return value.replace(
    /\[\[(MATH|CHEM):([\s\S]*?)\]\]/g,
    (_match, _kind, formula) => {
      const normalizedFormula = asString(formula).trim();
      return normalizedFormula ? ` ${normalizedFormula} ` : " ";
    },
  );
}


export function sanitizeStudentFacingText(value: unknown) {
  return stripMathTypeTokens(asString(value)).replace(/\s+/g, " ").trim();
}


export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}


export function normalizePhoneIdentifier(identifier: string) {
  const trimmed = identifier.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length === 9) {
    return `+996${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("996")) {
    return `+${digits}`;
  }

  if (trimmed.startsWith("+") && digits.length >= 10) {
    return `+${digits}`;
  }

  return null;
}


export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}


export async function getPasswordResetTokenOrThrow(rawToken?: string) {
  const token = rawToken?.trim();
  ensure(token, 400, "Некорректный запрос");

  const tokenHash = hashResetToken(token);
  const resetToken = await lmsRepository.prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  ensure(resetToken, 400, "Некорректный запрос");
  ensure(!resetToken.usedAt, 400, "Некорректный запрос");
  ensure(
    resetToken.expiresAt.getTime() > Date.now(),
    400,
    "Операция недоступна",
  );

  return resetToken;
}


export function coursePreview(course: {
  id: string;
  title: string;
  category: string;
  description: string;
  level: CourseLevel;
  isPublished: boolean;
}) {
  return {
    id: course.id,
    title: course.title,
    category: course.category,
    description: course.description,
    level: course.level,
    isPublished: course.isPublished,
  };
}


export async function getCurrentUser(userId?: string) {
  if (!userId) {
    return null;
  }
  return lmsRepository.prisma.user.findUnique({ where: { id: userId } });
}


export async function requireCurrentUser(userId?: string) {
  const currentUser = await getCurrentUser(userId);
  ensure(currentUser, 404, "Ресурс не найден");
  return currentUser;
}


export async function notifyStudentsAboutPublishedCourse(params: {
  courseId: string;
  courseTitle: string;
}) {
  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.new_announcement,
      title: "Опубликован новый курс",
      body: `Курс "${params.courseTitle}" опубликован и доступен студентам.`,
      targetRole: NotificationTargetRole.student,
      userId: null,
    },
  });
}


export async function notifyStudentsAboutCompletedCourse(params: {
  courseId: string;
  courseTitle: string;
}) {
  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: { courseId: params.courseId },
    select: { studentId: true },
  });

  for (const enrollment of enrollments) {
    await lmsRepository.prisma.notification.create({
      data: {
        id: await lmsRepository.nextNotificationId(),
        type: NotificationType.system_message,
        title: "Курс завершен",
        body: `Курс "${params.courseTitle}" завершен преподавателем.`,
        targetRole: NotificationTargetRole.student,
        userId: enrollment.studentId,
      },
    });
  }
}


export async function notifyStudentsAboutNewAssignment(params: {
  courseId: string;
  courseTitle: string;
  assignmentTitle: string;
  dueAt?: Date;
}) {
  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: { courseId: params.courseId },
    select: { studentId: true },
  });

  for (const enrollment of enrollments) {
    await lmsRepository.prisma.notification.create({
      data: {
        id: await lmsRepository.nextNotificationId(),
        type: NotificationType.assignment_deadline,
        title: "Добавлено новое задание",
        body: params.dueAt
          ? `${params.courseTitle}: "${sanitizeStudentFacingText(params.assignmentTitle)}". Срок сдачи: ${params.dueAt.toLocaleString("ru-RU")}.`
          : `${params.courseTitle}: добавлено задание "${sanitizeStudentFacingText(params.assignmentTitle)}".`,
        targetRole: NotificationTargetRole.student,
        userId: enrollment.studentId,
      },
    });
  }
}


export async function nextAssignmentId() {
  return `a_${crypto.randomUUID()}`;
}


export async function nextGradeId() {
  return `g_${crypto.randomUUID()}`;
}


export async function nextSubmissionId() {
  return `s_${crypto.randomUUID()}`;
}


export type SubmissionAttachmentPayload = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};


export type LessonMaterialFilePayload = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};


export type SubmissionContentPayload = {
  text: string;
  formula: string;
  code: string;
  attachments: SubmissionAttachmentPayload[];
};


export const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENTS_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_LESSON_MATERIAL_FILE_SIZE_BYTES = 20 * 1024 * 1024;


export function normalizeBase64Data(value: string) {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}


export function estimateBase64DecodedBytes(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}


export function normalizeLessonMaterialFile(
  value: unknown,
): LessonMaterialFilePayload | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = asString(value.name).trim();
  const type = asString(value.type).trim().toLowerCase();
  const base64 = normalizeBase64Data(asString(value.dataBase64));
  const sizeFromInput = Number(value.size) || 0;
  const estimatedSize = estimateBase64DecodedBytes(base64);
  const size = Math.max(sizeFromInput, estimatedSize);

  if (!name || !type || !base64) {
    return null;
  }

  return {
    name,
    type,
    size,
    dataBase64: base64,
  };
}


export function parseStoredSubmissionContent(
  rawContent?: string | null,
): SubmissionContentPayload {
  if (!rawContent) {
    return { text: "", formula: "", code: "", attachments: [] };
  }

  try {
    const parsed = JSON.parse(rawContent) as {
      text?: unknown;
      formula?: unknown;
      code?: unknown;
      attachments?: unknown;
    };

    const rawAttachments = Array.isArray(parsed.attachments)
      ? parsed.attachments
      : [];

    return {
      text: asString(parsed.text).trim(),
      formula: asString(parsed.formula).trim(),
      code: asString(parsed.code).trim(),
      attachments: rawAttachments
        .filter(isRecord)
        .map((item) => ({
          name: asString(item.name).trim(),
          type: asString(item.type).trim() || "application/octet-stream",
          size: Number(item.size) || 0,
          dataBase64: asString(item.dataBase64).trim(),
        }))
        .filter((item) => item.name && item.dataBase64),
    };
  } catch {
    return {
      text: rawContent,
      formula: "",
      code: "",
      attachments: [],
    };
  }
}


export function normalizeSubmissionInput(
  input: unknown,
  fallback: SubmissionContentPayload,
): SubmissionContentPayload {
  const raw = isRecord(input)
    ? input
    : {
        content: typeof input === "string" ? input : "",
      };

  const attachmentsProvided = Object.prototype.hasOwnProperty.call(
    raw,
    "attachments",
  );
  ensure(!attachmentsProvided || Array.isArray(raw.attachments), 400, "Вложения должны быть переданы списком");
  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];
  const attachments = rawAttachments.map((item) => {
    ensure(isRecord(item), 400, "Некорректное вложение");
    const name = asString(item.name).trim();
    ensure(name, 400, "Укажите имя вложенного файла");
    const dataBase64 = normalizeBase64Data(asString(item.dataBase64)).replace(/\s+/g, "");
    ensure(dataBase64, 400, "Вложение не содержит данных");
    const declaredSize = item.size === undefined ? 0 : Number(item.size);
    ensure(Number.isFinite(declaredSize) && declaredSize >= 0, 400, "Некорректный размер вложения");
    const estimatedSize = estimateBase64DecodedBytes(dataBase64);
    ensure(estimatedSize <= MAX_ATTACHMENT_SIZE_BYTES, 400, "Размер вложения не должен превышать 8 МБ");
    const decoded = Buffer.from(dataBase64, "base64");
    ensure(decoded.length > 0 && decoded.toString("base64") === dataBase64, 400, "Данные вложения повреждены. Выберите файл повторно");
    return {
      name,
      type: asString(item.type).trim() || "application/octet-stream",
      size: Math.max(declaredSize, decoded.length),
      dataBase64,
    };
  });

  return {
    text:
      asString(raw.content).trim() ||
      (!attachmentsProvided ? fallback.text : ""),
    formula:
      asString(raw.formula).trim() ||
      (!attachmentsProvided ? fallback.formula : ""),
    code:
      asString(raw.code).trim() || (!attachmentsProvided ? fallback.code : ""),
    attachments: attachmentsProvided ? attachments : fallback.attachments,
  };
}


export function sanitizeSubmissionForResponse(payload: SubmissionContentPayload) {
  return {
    text: payload.text,
    formula: payload.formula,
    code: payload.code,
    attachments: payload.attachments.map((item) => ({
      name: item.name,
      type: item.type,
      size: item.size,
    })),
  };
}

