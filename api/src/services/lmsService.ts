import {
  AccessRequestStatus,
  CourseLevel,
  NotificationTargetRole,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure, HttpError } from "../utils/httpError";
import {
  createCourseInviteToken,
  createToken,
  verifyCourseInviteToken,
} from "../utils/jwt";
import {
  buildResetPasswordLink,
  sendResetPasswordEmail,
} from "../utils/mailer";

function isUserRole(value: unknown): value is UserRole {
  return (
    value === UserRole.student ||
    value === UserRole.teacher ||
    value === UserRole.admin
  );
}

function isCourseLevel(value: unknown): value is CourseLevel {
  return (
    value === CourseLevel.beginner ||
    value === CourseLevel.intermediate ||
    value === CourseLevel.advanced
  );
}

function isAccessRequestStatus(value: unknown): value is AccessRequestStatus {
  return (
    value === AccessRequestStatus.pending ||
    value === AccessRequestStatus.approved ||
    value === AccessRequestStatus.rejected
  );
}

function canMessageBetween(fromRole: UserRole, toRole: UserRole) {
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

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function isUserOnline(lastSeenAt?: Date | null) {
  if (!lastSeenAt) {
    return false;
  }
  return Date.now() - lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
}

function userPublic(user: {
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

function normalizeLegacyNotification<
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

function readModules(modules: unknown) {
  return Array.isArray(modules) ? modules : [];
}

type StudentLessonProgressSummary = {
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  completedLessonIds: string[];
};

function makeEntityId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function asModuleRecordArray(modules: unknown) {
  return readModules(modules).filter((item): item is Record<string, unknown> =>
    isRecord(item),
  );
}

function readVisibleLessonIds(modules: unknown) {
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

function calculateProgressPercent(completed: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((completed / total) * 100);
}

async function getStudentLessonProgress(params: {
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

function findLessonIndex(modules: Record<string, unknown>[], lessonId: string) {
  return modules.findIndex(
    (item) =>
      asString(item.type).toLowerCase() === "lesson" &&
      asString(item.id) === lessonId,
  );
}

function isAssignmentVisibleToStudents(
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

function readLessonTitleById(courseModules: unknown, lessonId?: string | null) {
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

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stripMathTypeTokens(value: string) {
  return value.replace(
    /\[\[(MATH|CHEM):([\s\S]*?)\]\]/g,
    (_match, _kind, formula) => {
      const normalizedFormula = asString(formula).trim();
      return normalizedFormula ? ` ${normalizedFormula} ` : " ";
    },
  );
}

function sanitizeStudentFacingText(value: unknown) {
  return stripMathTypeTokens(asString(value)).replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePhoneIdentifier(identifier: string) {
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

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getPasswordResetTokenOrThrow(rawToken?: string) {
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

function coursePreview(course: {
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

async function getCurrentUser(userId?: string) {
  if (!userId) {
    return null;
  }
  return lmsRepository.prisma.user.findUnique({ where: { id: userId } });
}

async function requireCurrentUser(userId?: string) {
  const currentUser = await getCurrentUser(userId);
  ensure(currentUser, 404, "Ресурс не найден");
  return currentUser;
}

async function notifyStudentsAboutPublishedCourse(params: {
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

async function notifyStudentsAboutCompletedCourse(params: {
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

async function notifyStudentsAboutNewAssignment(params: {
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

export async function register(input: {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  courseInviteToken?: string;
}) {
  const { fullName, email, phone, password, role } = input;
  const inviteToken =
    typeof input.courseInviteToken === "string"
      ? input.courseInviteToken.trim()
      : "";

  ensure(
    fullName && email && phone && password && role,
    400,
    "Операция недоступна",
  );
  ensure(
    role === UserRole.student || role === UserRole.teacher,
    400,
    "Операция недоступна",
  );

  const invitePayload = inviteToken
    ? verifyCourseInviteToken(inviteToken)
    : null;

  if (inviteToken) {
    ensure(
      invitePayload,
      400,
      "Ссылка приглашения недействительна или устарела",
    );
    ensure(
      role === UserRole.student,
      400,
      "Приглашение доступно только для роли student",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const userExists = await lmsRepository.prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
    select: { id: true },
  });

  ensure(!userExists, 409, "Операция недоступна");

  const registrationResult = await lmsRepository.prisma.$transaction(
    async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          id: await lmsRepository.nextUserId(),
          fullName: fullName.trim(),
          email: normalizedEmail,
          phone: normalizedPhone,
          passwordHash: await bcrypt.hash(password, 12),
          role,
        },
      });

      let autoEnrollment:
        | {
            courseId: string;
            courseTitle: string;
          }
        | undefined;

      if (invitePayload) {
        const invitedCourse = await tx.course.findUnique({
          where: { id: invitePayload.courseId },
          select: { id: true, title: true, teacherId: true },
        });

        ensure(
          invitedCourse && invitedCourse.teacherId === invitePayload.teacherId,
          400,
          "Ссылка приглашения недействительна или устарела",
        );

        await tx.enrollment.create({
          data: {
            id: await lmsRepository.nextEnrollmentId(),
            courseId: invitedCourse.id,
            studentId: createdUser.id,
            approvedByTeacherId: invitedCourse.teacherId,
            approvedAt: new Date(),
          },
        });

        await tx.notification.create({
          data: {
            id: await lmsRepository.nextNotificationId(),
            type: NotificationType.system_message,
            title: "Доступ к курсу открыт",
            body: `Вы автоматически зачислены на курс \"${invitedCourse.title}\".`,
            targetRole: NotificationTargetRole.student,
            userId: createdUser.id,
          },
        });

        autoEnrollment = {
          courseId: invitedCourse.id,
          courseTitle: invitedCourse.title,
        };
      }

      return { createdUser, autoEnrollment };
    },
  );

  const { createdUser } = registrationResult;

  return {
    message: "Успешно",
    token: createToken({ id: createdUser.id, role: createdUser.role }),
    user: {
      id: createdUser.id,
      fullName: createdUser.fullName,
      email: createdUser.email,
      phone: createdUser.phone,
      role: createdUser.role,
    },
    autoEnrollment: registrationResult.autoEnrollment,
  };
}

export async function login(input: { identifier?: string; password?: string }) {
  const identifier = input.identifier?.trim();
  const { password } = input;
  ensure(identifier && password, 400, "Некорректный запрос");

  const normalizedPhone = normalizePhoneIdentifier(identifier);
  const loginCandidates = [identifier, identifier.toLowerCase()];
  if (normalizedPhone) {
    loginCandidates.push(normalizedPhone);
  }

  const user = await lmsRepository.prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        ...Array.from(new Set(loginCandidates)).map((candidate) => ({
          phone: candidate,
        })),
      ],
    },
  });

  ensure(user, 401, "Неверный логин или пароль");
  ensure(!user.isBlocked, 403, "Доступ запрещен");
  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  ensure(isValidPassword, 401, "Неверный логин или пароль");

  return {
    message: "Успешно",
    token: createToken({ id: user.id, role: user.role }),
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
  };
}

export async function requestPasswordReset(input: { email?: string }) {
  const email = input.email?.trim().toLowerCase();
  ensure(email, 400, "Некорректный запрос");

  const user = await lmsRepository.prisma.user.findUnique({
    where: { email },
    select: { id: true, fullName: true, email: true },
  });
  ensure(user, 404, "Ресурс не найден");

  await lmsRepository.prisma.passwordResetToken.deleteMany({
    where: {
      userId: user.id,
      OR: [{ usedAt: { not: null } }, { expiresAt: { lte: new Date() } }],
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await lmsRepository.prisma.passwordResetToken.create({
    data: {
      id: makeEntityId("prt"),
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const resetLink = buildResetPasswordLink(rawToken);
  await sendResetPasswordEmail({
    to: user.email,
    fullName: user.fullName,
    resetLink,
  });

  return {
    message: "Вам на почту выслана ссылка для сброса пароля",
  };
}

export async function resetPasswordByToken(input: {
  token?: string;
  password?: string;
  confirmPassword?: string;
}) {
  const password = input.password?.trim();
  const confirmPassword = input.confirmPassword?.trim();

  ensure(password, 400, "Некорректный запрос");
  ensure(password.length >= 6, 400, "Операция недоступна");
  ensure(password === confirmPassword, 400, "Некорректный запрос");

  const resetToken = await getPasswordResetTokenOrThrow(input.token);

  const hashedPassword = await bcrypt.hash(password, 12);
  await lmsRepository.prisma.$transaction([
    lmsRepository.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: hashedPassword },
    }),
    lmsRepository.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    lmsRepository.prisma.notification.create({
      data: {
        id: await lmsRepository.nextNotificationId(),
        type: NotificationType.system_message,
        title: "Сброс пароля выполнен",
        body: `Сброс пароля выполнен: ${resetToken.user.fullName} (${resetToken.user.email})`,
        targetRole: NotificationTargetRole.admin,
        userId: null,
      },
    }),
  ]);

  return { message: "Успешно" };
}

export async function validateResetPasswordToken(input: { token?: string }) {
  const resetToken = await getPasswordResetTokenOrThrow(input.token);

  ensure(!resetToken.openedAt, 400, "Некорректный запрос");

  const updateResult = await lmsRepository.prisma.passwordResetToken.updateMany(
    {
      where: {
        id: resetToken.id,
        openedAt: null,
      },
      data: {
        openedAt: new Date(),
      },
    },
  );

  ensure(updateResult.count === 1, 400, "Некорректный запрос");

  return { valid: true };
}

export async function me(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  return {
    user: {
      id: currentUser.id,
      fullName: currentUser.fullName,
      email: currentUser.email,
      phone: currentUser.phone,
      role: currentUser.role,
    },
  };
}

export async function listCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);

  if (currentUser.role === UserRole.admin) {
    const courses = await lmsRepository.prisma.course.findMany({
      orderBy: { createdAt: "desc" },
    });
    return {
      courses: courses.map((item) => ({
        ...item,
        modules: readModules(item.modules),
      })),
    };
  }

  if (currentUser.role === UserRole.teacher) {
    const courses = await lmsRepository.prisma.course.findMany({
      where: { teacherId: currentUser.id },
      orderBy: { createdAt: "desc" },
    });
    return {
      courses: courses.map((item) => ({
        ...item,
        modules: readModules(item.modules),
      })),
    };
  }

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: { studentId: currentUser.id },
    select: { courseId: true },
  });

  const courses = await lmsRepository.prisma.course.findMany({
    where: {
      id: { in: enrollments.map((item) => item.courseId) },
      OR: [{ isPublished: true }, { progress: { gte: 100 } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    courses: courses.map((item) => ({
      ...item,
      modules: readModules(item.modules),
    })),
  };
}

export async function getCourseById(courseId: string, userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  if (currentUser.role === UserRole.admin) {
    return { course: { ...course, modules: readModules(course.modules) } };
  }

  if (currentUser.role === UserRole.teacher) {
    ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");
    return { course: { ...course, modules: readModules(course.modules) } };
  }

  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });

  ensure(enrollment, 403, "Доступ запрещен");
  ensure(course.isPublished || course.progress >= 100, 403, "Доступ запрещен");

  const studentProgress = await getStudentLessonProgress({
    courseId: course.id,
    studentId: currentUser.id,
    modules: course.modules,
  });

  return {
    course: {
      ...course,
      modules: readModules(course.modules),
      progress: studentProgress.progressPercent,
      studentProgress,
    },
  };
}

export async function createCourseLegacy(input: {
  name?: string;
  description?: string;
  teacher_id?: string;
}) {
  const { name, description, teacher_id } = input;
  ensure(name && description && teacher_id, 400, "Операция недоступна");

  const teacher = await lmsRepository.prisma.user.findFirst({
    where: { id: teacher_id, role: UserRole.teacher },
    select: { id: true },
  });
  ensure(teacher, 404, "Ресурс не найден");

  const createdCourse = await lmsRepository.prisma.course.create({
    data: {
      id: await lmsRepository.nextCourseId(),
      title: name,
      category: "General",
      description,
      level: CourseLevel.beginner,
      progress: 0,
      modules: [],
      teacherId: teacher.id,
    },
  });

  return {
    course: { ...createdCourse, modules: readModules(createdCourse.modules) },
    teacher_id: teacher.id,
  };
}

export async function discoverStudentCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: { studentId: currentUser.id },
    select: { courseId: true },
  });
  const enrolledIds = enrollments.map((item) => item.courseId);

  const courses = await lmsRepository.prisma.course.findMany({
    where: {
      id: { notIn: enrolledIds.length > 0 ? enrolledIds : [""] },
      isPublished: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return { courses: courses.map((item) => coursePreview(item)) };
}

export async function listPublicCourses() {
  const courses = await lmsRepository.prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  return { courses: courses.map((item) => coursePreview(item)) };
}

export async function getPublicStats() {
  const [students, teachers, publishedCourses, gradeAggregate] =
    await Promise.all([
      lmsRepository.prisma.user.count({ where: { role: UserRole.student } }),
      lmsRepository.prisma.user.count({ where: { role: UserRole.teacher } }),
      lmsRepository.prisma.course.count({ where: { isPublished: true } }),
      lmsRepository.prisma.grade.aggregate({
        _avg: { score: true },
      }),
    ]);

  const averageScore =
    typeof gradeAggregate._avg.score === "undefined" ||
    gradeAggregate._avg.score === null
      ? null
      : Number(gradeAggregate._avg.score);

  const satisfiedStudentsPercent =
    averageScore === null
      ? null
      : Math.max(0, Math.min(100, Math.round(averageScore)));

  return {
    students,
    courses: publishedCourses,
    teachers,
    satisfiedStudentsPercent,
  };
}

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

export async function adminOverview() {
  const [users, courses] = await Promise.all([
    lmsRepository.prisma.user.count(),
    lmsRepository.prisma.course.count(),
  ]);

  return {
    metrics: {
      users,
      courses,
      activeRoles: [UserRole.admin, UserRole.teacher, UserRole.student],
    },
  };
}

export async function adminListUsers() {
  const users = await lmsRepository.prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isBlocked: true,
      lastSeenAt: true,
    },
    orderBy: { fullName: "asc" },
  });
  return { users: users.map((item) => userPublic(item)) };
}

export async function adminCreateUser(input: {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: unknown;
}) {
  const { fullName, email, phone, password, role } = input;
  ensure(
    fullName && email && phone && password && isUserRole(role),
    400,
    "Операция недоступна",
  );

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim();

  const duplicate = await lmsRepository.prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    },
    select: { id: true },
  });
  ensure(!duplicate, 409, "Операция недоступна");

  const created = await lmsRepository.prisma.user.create({
    data: {
      id: await lmsRepository.nextUserId(),
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash: await bcrypt.hash(password, 12),
      role,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isBlocked: true,
    },
  });

  return { user: userPublic(created) };
}

export async function adminUpdateUser(
  currentUserId: string | undefined,
  userId: string,
  input: {
    fullName?: string;
    email?: string;
    phone?: string;
    role?: unknown;
    password?: string;
  },
) {
  const currentUser = await requireCurrentUser(currentUserId);
  const userToUpdate = await lmsRepository.prisma.user.findUnique({
    where: { id: userId },
  });
  ensure(userToUpdate, 404, "Ресурс не найден");

  if (typeof input.role !== "undefined") {
    ensure(isUserRole(input.role), 400, "Операция недоступна");
    if (currentUser.id === userToUpdate.id && input.role !== UserRole.admin) {
      throw new HttpError(400, "Операция недоступна");
    }
  }

  if (typeof input.fullName === "string") {
    ensure(input.fullName.trim(), 400, "Некорректный запрос");
  }

  if (typeof input.email === "string") {
    const normalizedEmail = input.email.trim().toLowerCase();
    ensure(normalizedEmail, 400, "Некорректный запрос");
    const duplicateEmail = await lmsRepository.prisma.user.findFirst({
      where: { id: { not: userToUpdate.id }, email: normalizedEmail },
      select: { id: true },
    });
    ensure(!duplicateEmail, 409, "Конфликт данных");
  }

  if (typeof input.phone === "string") {
    const normalizedPhone = input.phone.trim();
    ensure(normalizedPhone, 400, "Некорректный запрос");
    const duplicatePhone = await lmsRepository.prisma.user.findFirst({
      where: { id: { not: userToUpdate.id }, phone: normalizedPhone },
      select: { id: true },
    });
    ensure(!duplicatePhone, 409, "Операция недоступна");
  }

  const updated = await lmsRepository.prisma.user.update({
    where: { id: userId },
    data: {
      fullName:
        typeof input.fullName === "string" ? input.fullName.trim() : undefined,
      email:
        typeof input.email === "string"
          ? input.email.trim().toLowerCase()
          : undefined,
      phone: typeof input.phone === "string" ? input.phone.trim() : undefined,
      role: typeof input.role !== "undefined" ? input.role : undefined,
      passwordHash:
        typeof input.password === "string" && input.password.trim()
          ? await bcrypt.hash(input.password.trim(), 12)
          : undefined,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isBlocked: true,
    },
  });

  return { user: userPublic(updated) };
}

export async function adminDeleteUser(
  currentUserId: string | undefined,
  userId: string,
) {
  const currentUser = await requireCurrentUser(currentUserId);
  const targetUser = await lmsRepository.prisma.user.findUnique({
    where: { id: userId },
  });
  ensure(targetUser, 404, "Ресурс не найден");
  ensure(targetUser.id !== currentUser.id, 400, "Операция недоступна");

  await lmsRepository.prisma.$transaction([
    lmsRepository.prisma.course.updateMany({
      where: { teacherId: userId },
      data: { teacherId: currentUser.id },
    }),
    lmsRepository.prisma.enrollment.updateMany({
      where: { approvedByTeacherId: userId },
      data: { approvedByTeacherId: currentUser.id },
    }),
    lmsRepository.prisma.accessRequest.updateMany({
      where: { teacherId: userId },
      data: { teacherId: currentUser.id },
    }),
    lmsRepository.prisma.grade.updateMany({
      where: { gradedById: userId },
      data: { gradedById: currentUser.id },
    }),
    lmsRepository.prisma.user.delete({ where: { id: userId } }),
  ]);

  return {
    message: "Успешно",
    user: userPublic(targetUser),
  };
}

export async function adminBlockUser(
  currentUserId: string | undefined,
  userId: string,
) {
  const currentUser = await requireCurrentUser(currentUserId);
  const targetUser = await lmsRepository.prisma.user.findUnique({
    where: { id: userId },
  });
  ensure(targetUser, 404, "Ресурс не найден");
  ensure(targetUser.id !== currentUser.id, 400, "Некорректный запрос");

  await lmsRepository.prisma.user.update({
    where: { id: targetUser.id },
    data: { isBlocked: true },
  });

  return {
    message: "Успешно",
    user: userPublic(targetUser),
  };
}

export async function adminUnblockUser(
  currentUserId: string | undefined,
  userId: string,
) {
  const currentUser = await requireCurrentUser(currentUserId);
  const targetUser = await lmsRepository.prisma.user.findUnique({
    where: { id: userId },
  });
  ensure(targetUser, 404, "Ресурс не найден");
  ensure(targetUser.id !== currentUser.id, 400, "Некорректный запрос");

  await lmsRepository.prisma.user.update({
    where: { id: targetUser.id },
    data: { isBlocked: false },
  });

  return {
    message: "Успешно",
    user: userPublic(targetUser),
  };
}

export async function adminResetUserPassword(
  currentUserId: string | undefined,
  userId: string,
  password?: string,
) {
  await requireCurrentUser(currentUserId);
  const targetUser = await lmsRepository.prisma.user.findUnique({
    where: { id: userId },
  });
  ensure(targetUser, 404, "Ресурс не найден");

  const generatedPassword = password?.trim() || `BilimMentor_${Date.now()}`;

  await lmsRepository.prisma.user.update({
    where: { id: targetUser.id },
    data: { passwordHash: await bcrypt.hash(generatedPassword, 12) },
  });

  return {
    message: "Успешно",
    user: userPublic(targetUser),
    temporaryPassword: generatedPassword,
  };
}

export async function adminCreateCourse(input: {
  title?: string;
  name?: string;
  category?: string;
  description?: string;
  level?: unknown;
  teacher_id?: string;
}) {
  const normalizedTitle = (input.title ?? input.name ?? "").trim();
  const normalizedCategory = (input.category ?? "General").trim();
  const normalizedDescription = (input.description ?? "").trim();
  const normalizedLevel =
    typeof input.level === "string"
      ? input.level.trim().toLowerCase()
      : CourseLevel.beginner;

  ensure(
    normalizedTitle && normalizedDescription && input.teacher_id,
    400,
    "Операция недоступна",
  );
  ensure(isCourseLevel(normalizedLevel), 400, "Операция недоступна");

  const teacher = await lmsRepository.prisma.user.findFirst({
    where: { id: input.teacher_id, role: UserRole.teacher },
    select: { id: true },
  });
  ensure(teacher, 404, "Ресурс не найден");

  const created = await lmsRepository.prisma.course.create({
    data: {
      id: await lmsRepository.nextCourseId(),
      title: normalizedTitle,
      category: normalizedCategory || "General",
      description: normalizedDescription,
      level: normalizedLevel,
      isPublished: false,
      progress: 0,
      modules: [],
      teacherId: teacher.id,
    },
  });

  return {
    course: { ...created, modules: readModules(created.modules) },
    teacher_id: teacher.id,
  };
}

export async function adminUpdateCourse(
  courseId: string,
  input: {
    title?: string;
    name?: string;
    category?: string;
    description?: string;
    level?: unknown;
    teacher_id?: string;
    isPublished?: unknown;
    createdAt?: unknown;
  },
) {
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  if (typeof input.title === "string" || typeof input.name === "string") {
    ensure(
      (input.title ?? input.name ?? "").trim(),
      400,
      "Операция недоступна",
    );
  }

  if (typeof input.category === "string") {
    ensure(input.category.trim(), 400, "Некорректный запрос");
  }

  if (typeof input.description === "string") {
    ensure(input.description.trim(), 400, "Некорректный запрос");
  }

  if (typeof input.level !== "undefined") {
    const normalizedLevel =
      typeof input.level === "string" ? input.level.trim().toLowerCase() : "";
    ensure(isCourseLevel(normalizedLevel), 400, "Операция недоступна");
  }

  if (typeof input.teacher_id === "string") {
    const teacher = await lmsRepository.prisma.user.findFirst({
      where: { id: input.teacher_id, role: UserRole.teacher },
      select: { id: true },
    });
    ensure(teacher, 404, "Ресурс не найден");
  }

  if (typeof input.isPublished !== "undefined") {
    ensure(typeof input.isPublished === "boolean", 400, "Некорректный запрос");
  }

  if (typeof input.createdAt !== "undefined") {
    ensure(typeof input.createdAt === "string", 400, "Некорректный запрос");
    const parsedCreatedAt = new Date(input.createdAt);
    ensure(
      !Number.isNaN(parsedCreatedAt.getTime()),
      400,
      "Некорректный запрос",
    );
  }

  const normalizedUpdateLevel =
    typeof input.level === "string" &&
    isCourseLevel(input.level.trim().toLowerCase())
      ? (input.level.trim().toLowerCase() as CourseLevel)
      : undefined;

  const normalizedCreatedAt =
    typeof input.createdAt === "string" ? new Date(input.createdAt) : undefined;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      title:
        typeof input.title === "string" || typeof input.name === "string"
          ? (input.title ?? input.name ?? "").trim()
          : undefined,
      category:
        typeof input.category === "string" ? input.category.trim() : undefined,
      description:
        typeof input.description === "string"
          ? input.description.trim()
          : undefined,
      level: normalizedUpdateLevel,
      teacherId:
        typeof input.teacher_id === "string" ? input.teacher_id : undefined,
      isPublished:
        typeof input.isPublished === "boolean" ? input.isPublished : undefined,
      createdAt: normalizedCreatedAt,
    },
  });

  return {
    course: { ...updated, modules: readModules(updated.modules) },
    teacher_id: updated.teacherId,
  };
}

export async function adminCourseDetails(courseId: string) {
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  ensure(course, 404, "Ресурс не найден");

  return {
    course: {
      ...course,
      modules: readModules(course.modules),
    },
  };
}

export async function adminCreateLesson(
  courseId: string,
  input: { title?: string; description?: string },
) {
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  const title = (input.title ?? "").trim();
  ensure(title, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const duplicateExists = modules.some((item) => {
    const type = asString(item.type).toLowerCase();
    if (type !== "lesson") return false;
    return asString(item.title).trim().toLowerCase() === title.toLowerCase();
  });
  ensure(!duplicateExists, 409, "Конфликт данных");

  const lesson = {
    id: makeEntityId("lesson"),
    type: "lesson",
    title,
    description:
      (input.description ?? "").trim().length > 0
        ? (input.description ?? "")
        : null,
    isVisibleToStudents: false,
    createdAt: new Date().toISOString(),
    materials: [] as Record<string, unknown>[],
  };

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      modules: [...modules, lesson] as Prisma.InputJsonValue,
    },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function adminUpdateLesson(
  courseId: string,
  lessonId: string,
  input: { title?: string; description?: string },
) {
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  const normalizedTitle = (input.title ?? "").trim();
  ensure(normalizedTitle, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const duplicateExists = modules.some((item, index) => {
    if (index === lessonIndex) return false;
    const type = asString(item.type).toLowerCase();
    if (type !== "lesson") return false;
    return (
      asString(item.title).trim().toLowerCase() ===
      normalizedTitle.toLowerCase()
    );
  });
  ensure(!duplicateExists, 409, "Конфликт данных");

  const lesson = {
    ...modules[lessonIndex],
    title: normalizedTitle,
    description:
      (input.description ?? "").trim().length > 0
        ? (input.description ?? "")
        : null,
    updatedAt: new Date().toISOString(),
  };

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function adminDeleteLesson(courseId: string, lessonId: string) {
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const deletedLesson = modules[lessonIndex];
  const nextModules = modules.filter((item) => asString(item.id) !== lessonId);

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson: deletedLesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function adminDeleteLessonMaterial(
  courseId: string,
  lessonId: string,
  materialId: string,
) {
  const normalizedMaterialId = materialId.trim();
  ensure(normalizedMaterialId, 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = { ...modules[lessonIndex] };
  const currentMaterials = Array.isArray(lesson.materials)
    ? lesson.materials.filter((item): item is Record<string, unknown> =>
        isRecord(item),
      )
    : [];

  const nextMaterials = currentMaterials.filter(
    (item) => asString(item.id) !== normalizedMaterialId,
  );
  ensure(
    nextMaterials.length !== currentMaterials.length,
    404,
    "Ресурс не найден",
  );

  lesson.materials = nextMaterials;
  lesson.updatedAt = new Date().toISOString();

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function adminDeleteCourse(courseId: string) {
  const removed = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(removed, 404, "Ресурс не найден");

  await lmsRepository.prisma.course.delete({ where: { id: courseId } });

  return {
    message: "Успешно",
    course: { ...removed, modules: readModules(removed.modules) },
  };
}

type AdminCourseBulkAction = "publish" | "unpublish" | "delete";

function isAdminCourseBulkAction(
  value: unknown,
): value is AdminCourseBulkAction {
  return value === "publish" || value === "unpublish" || value === "delete";
}

export async function adminBulkCourses(input: {
  courseIds?: unknown;
  action?: unknown;
}) {
  ensure(Array.isArray(input.courseIds), 400, "Некорректный запрос");
  ensure(isAdminCourseBulkAction(input.action), 400, "Некорректный запрос");

  const normalizedCourseIds = Array.from(
    new Set(
      input.courseIds
        .map((item) => asString(item).trim())
        .filter((item) => item.length > 0),
    ),
  );

  ensure(normalizedCourseIds.length > 0, 400, "Некорректный запрос");
  ensure(normalizedCourseIds.length <= 200, 400, "Слишком много курсов");

  const existing = await lmsRepository.prisma.course.findMany({
    where: { id: { in: normalizedCourseIds } },
    select: { id: true },
  });
  ensure(existing.length > 0, 404, "Ресурс не найден");

  const existingSet = new Set(existing.map((item) => item.id));
  const applicableIds = normalizedCourseIds.filter((item) =>
    existingSet.has(item),
  );
  const missingCourseIds = normalizedCourseIds.filter(
    (item) => !existingSet.has(item),
  );

  let affectedCount = 0;
  if (input.action === "delete") {
    const deleted = await lmsRepository.prisma.course.deleteMany({
      where: { id: { in: applicableIds } },
    });
    affectedCount = deleted.count;
  } else {
    const updated = await lmsRepository.prisma.course.updateMany({
      where: { id: { in: applicableIds } },
      data: { isPublished: input.action === "publish" },
    });
    affectedCount = updated.count;
  }

  return {
    message: "Успешно",
    action: input.action,
    requestedCount: normalizedCourseIds.length,
    affectedCount,
    missingCourseIds,
  };
}

export async function adminCourseStudents(courseId: string) {
  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true },
  });
  ensure(course, 404, "Ресурс не найден");

  const [students, enrollments] = await Promise.all([
    lmsRepository.prisma.user.findMany({
      where: { role: UserRole.student },
      select: { id: true, fullName: true, email: true, phone: true },
      orderBy: { fullName: "asc" },
    }),
    lmsRepository.prisma.enrollment.findMany({
      where: { courseId },
      select: { studentId: true, approvedAt: true },
    }),
  ]);

  const enrollmentByStudent = enrollments.reduce<
    Record<string, { approvedAt: string }>
  >((acc, item) => {
    acc[item.studentId] = { approvedAt: item.approvedAt.toISOString() };
    return acc;
  }, {});

  return {
    course,
    students: students.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      isEnrolled: Boolean(enrollmentByStudent[student.id]),
      approvedAt: enrollmentByStudent[student.id]?.approvedAt ?? null,
    })),
  };
}

export async function adminSetCourseStudentEnrollment(
  courseId: string,
  studentId: string,
  enrolled?: unknown,
) {
  ensure(typeof enrolled === "boolean", 400, "Некорректный запрос");

  const [course, student] = await Promise.all([
    lmsRepository.prisma.course.findUnique({ where: { id: courseId } }),
    lmsRepository.prisma.user.findUnique({ where: { id: studentId } }),
  ]);

  ensure(course, 404, "Ресурс не найден");
  ensure(
    student && student.role === UserRole.student,
    404,
    "Операция недоступна",
  );

  const existingEnrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId,
        studentId,
      },
    },
  });

  if (enrolled) {
    if (!existingEnrollment) {
      await lmsRepository.prisma.enrollment.create({
        data: {
          id: await lmsRepository.nextEnrollmentId(),
          courseId,
          studentId,
          approvedByTeacherId: course.teacherId,
          approvedAt: new Date(),
        },
      });
    }

    return {
      message: "Успешно",
      enrollment: {
        courseId,
        studentId,
        isEnrolled: true,
      },
    };
  }

  if (existingEnrollment) {
    await lmsRepository.prisma.enrollment.delete({
      where: {
        courseId_studentId: {
          courseId,
          studentId,
        },
      },
    });
  }

  return {
    message: "Успешно",
    enrollment: {
      courseId,
      studentId,
      isEnrolled: false,
    },
  };
}

export async function adminReports() {
  const [
    usersCount,
    studentsCount,
    teachersCount,
    adminsCount,
    courses,
    enrollmentsCount,
    accessRequestsPending,
  ] = await Promise.all([
    lmsRepository.prisma.user.count(),
    lmsRepository.prisma.user.count({ where: { role: UserRole.student } }),
    lmsRepository.prisma.user.count({ where: { role: UserRole.teacher } }),
    lmsRepository.prisma.user.count({ where: { role: UserRole.admin } }),
    lmsRepository.prisma.course.findMany({
      select: { id: true, title: true, category: true, teacherId: true },
    }),
    lmsRepository.prisma.enrollment.count(),
    lmsRepository.prisma.accessRequest.count({
      where: { status: AccessRequestStatus.pending },
    }),
  ]);

  const enrollments = await lmsRepository.prisma.enrollment.groupBy({
    by: ["courseId"],
    _count: { _all: true },
  });

  const enrollmentByCourse = courses.map((course) => {
    const grouped = enrollments.find((item) => item.courseId === course.id);
    return {
      courseId: course.id,
      title: course.title,
      students: grouped?._count._all ?? 0,
      teacherId: course.teacherId,
    };
  });

  const coursesByCategory = courses.reduce<Record<string, number>>(
    (acc, course) => {
      acc[course.category] = (acc[course.category] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      users: usersCount,
      students: studentsCount,
      teachers: teachersCount,
      admins: adminsCount,
      courses: courses.length,
      enrollments: enrollmentsCount,
      accessRequestsPending,
    },
    coursesByCategory,
    enrollmentByCourse,
  };
}

export async function adminRunBackup() {
  return {
    message: "Успешно",
    startedAt: new Date().toISOString(),
  };
}

export async function adminRunRestore() {
  return {
    message: "Успешно",
    startedAt: new Date().toISOString(),
  };
}

export async function adminSettingsOverview() {
  const [
    usersTotal,
    adminsTotal,
    teachersTotal,
    studentsTotal,
    coursesTotal,
    pendingAccessRequests,
    notificationsTotal,
    messagesTotal,
  ] = await Promise.all([
    lmsRepository.prisma.user.count(),
    lmsRepository.prisma.user.count({ where: { role: UserRole.admin } }),
    lmsRepository.prisma.user.count({ where: { role: UserRole.teacher } }),
    lmsRepository.prisma.user.count({ where: { role: UserRole.student } }),
    lmsRepository.prisma.course.count(),
    lmsRepository.prisma.accessRequest.count({
      where: { status: AccessRequestStatus.pending },
    }),
    lmsRepository.prisma.notification.count(),
    lmsRepository.prisma.message.count(),
  ]);

  return {
    tools: [
      {
        id: "site",
        title: "Системное уведомление",
        desc: `Действие выполнено.`,
        value: coursesTotal,
      },
      {
        id: "roles",
        title: "Системное уведомление",
        desc: `Действие выполнено.`,
        value: usersTotal,
      },
      {
        id: "logins",
        title: "Системное уведомление",
        desc: `Действие выполнено.`,
        value: messagesTotal + notificationsTotal,
      },
      {
        id: "backup",
        title: "Системное уведомление",
        desc: `Действие выполнено.`,
        value: pendingAccessRequests,
      },
      {
        id: "restore",
        title: "Системное уведомление",
        desc: "Действие выполнено.",
        value: null,
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function studentRequestCourseAccess(
  userId: string | undefined,
  input: { courseId?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");
  ensure(input.courseId, 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: input.courseId },
  });
  ensure(course, 404, "Ресурс не найден");

  const alreadyEnrolled = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId: input.courseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });
  ensure(!alreadyEnrolled, 409, "Конфликт данных");

  const pendingRequest = await lmsRepository.prisma.accessRequest.findFirst({
    where: {
      courseId: input.courseId,
      studentId: currentUser.id,
      status: AccessRequestStatus.pending,
    },
    select: { id: true },
  });
  ensure(!pendingRequest, 409, "Конфликт данных");

  const request = await lmsRepository.prisma.accessRequest.create({
    data: {
      id: await lmsRepository.nextAccessRequestId(),
      courseId: input.courseId,
      studentId: currentUser.id,
      teacherId: course.teacherId,
      status: AccessRequestStatus.pending,
    },
  });

  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.system_message,
      title: "Новая заявка на доступ к курсу",
      body: `Студент ${currentUser.fullName} запросил доступ к курсу "${course.title}".`,
      targetRole: NotificationTargetRole.teacher,
      userId: course.teacherId,
    },
  });

  return { request };
}

export async function studentListCourseAccessRequests(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const requests = await lmsRepository.prisma.accessRequest.findMany({
    where: { studentId: currentUser.id },
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });

  return {
    requests: requests.map((item) => ({
      ...item,
      course: { ...item.course, modules: readModules(item.course.modules) },
    })),
  };
}

export async function teacherListCourseAccessRequests(
  userId: string | undefined,
  status?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedStatus =
    typeof status === "string" && isAccessRequestStatus(status)
      ? status
      : undefined;

  const requests = await lmsRepository.prisma.accessRequest.findMany({
    where: {
      teacherId: currentUser.id,
      status: normalizedStatus,
    },
    include: {
      course: true,
      student: {
        select: { id: true, fullName: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    requests: requests.map((item) => ({
      ...item,
      course: { ...item.course, modules: readModules(item.course.modules) },
      student: userPublic(item.student),
    })),
  };
}

export async function adminListCourseAccessRequests(status?: unknown) {
  const normalizedStatus =
    typeof status === "string" && isAccessRequestStatus(status)
      ? status
      : AccessRequestStatus.pending;

  const requests = await lmsRepository.prisma.accessRequest.findMany({
    where: { status: normalizedStatus },
    include: {
      course: {
        select: { id: true, title: true, teacherId: true },
      },
      student: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      teacher: {
        select: { id: true, fullName: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    requests: requests.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      studentId: item.studentId,
      teacherId: item.teacherId,
      status: item.status,
      createdAt: item.createdAt,
      reviewedAt: item.reviewedAt,
      course: item.course,
      student: userPublic(item.student),
      teacher: userPublic(item.teacher),
    })),
  };
}

export async function teacherCourseDetails(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        include: {
          student: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
            },
          },
        },
      },
      assignments: {
        include: {
          submissions: {
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  role: true,
                },
              },
              grade: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = readModules(course.modules);

  const materials = modules
    .filter(
      (item) =>
        isRecord(item) && asString(item.type).toLowerCase() === "material",
    )
    .map((item, index) => {
      const record = item as Record<string, unknown>;
      const name = asString(record.name) || `Действие выполнено`;
      return {
        id: `m-${course.id}-${index + 1}`,
        title: name,
        type: record.url ? "LINK" : "FILE",
        uploadedAt:
          asString(record.createdAt) || course.createdAt.toISOString(),
        url: asString(record.url) || null,
      };
    });

  const students = course.enrollments.map((item) => ({
    id: item.student.id,
    fullName: item.student.fullName,
    email: item.student.email,
    phone: item.student.phone,
    approvedAt: item.approvedAt,
  }));

  const assignments = course.assignments.map((item) => ({
    id: item.id,
    title: item.title,
    lessonId: item.lessonId,
    dueAt: item.dueAt,
    submissions: item.submissions.length,
  }));

  const submissions = course.assignments.flatMap((assignment) =>
    assignment.submissions.map((submission) => ({
      id: submission.id,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      studentId: submission.studentId,
      studentName: submission.student.fullName,
      submittedAt: submission.submittedAt,
      score: submission.grade?.score ?? null,
      feedback: submission.grade?.feedback ?? null,
      status: submission.grade?.score !== null ? "Enabled" : "Disabled",
    })),
  );

  return {
    course: {
      id: course.id,
      title: course.title,
      category: course.category,
      description: course.description,
      level: course.level,
      isPublished: course.isPublished,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      teacherId: course.teacherId,
      modules,
    },
    students,
    materials,
    assignments,
    submissions,
  };
}

export async function teacherReviewCourseAccessRequest(
  userId: string | undefined,
  requestId: string,
  status?: AccessRequestStatus,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const accessRequest = await lmsRepository.prisma.accessRequest.findUnique({
    where: { id: requestId },
  });
  ensure(accessRequest, 404, "Ресурс не найден");
  ensure(
    accessRequest.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );
  ensure(
    accessRequest.status === AccessRequestStatus.pending,
    409,
    "Операция недоступна",
  );

  ensure(
    status === AccessRequestStatus.approved ||
      status === AccessRequestStatus.rejected,
    400,
    "Операция недоступна",
  );

  const [requestCourse, requestStudent] = await Promise.all([
    lmsRepository.prisma.course.findUnique({
      where: { id: accessRequest.courseId },
      select: { title: true },
    }),
    lmsRepository.prisma.user.findUnique({
      where: { id: accessRequest.studentId },
      select: { id: true, fullName: true },
    }),
  ]);
  ensure(requestCourse && requestStudent, 404, "Операция недоступна");

  const reviewedAt = new Date();

  const updatedRequest = await lmsRepository.prisma.$transaction(async (tx) => {
    const updated = await tx.accessRequest.update({
      where: { id: accessRequest.id },
      data: { status, reviewedAt },
    });

    if (status === AccessRequestStatus.approved) {
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId: accessRequest.courseId,
            studentId: accessRequest.studentId,
          },
        },
      });

      if (!existingEnrollment) {
        await tx.enrollment.create({
          data: {
            id: await lmsRepository.nextEnrollmentId(),
            courseId: accessRequest.courseId,
            studentId: accessRequest.studentId,
            approvedByTeacherId: currentUser.id,
            approvedAt: reviewedAt,
          },
        });
      }
    }

    await tx.notification.create({
      data: {
        id: await lmsRepository.nextNotificationId(),
        type: NotificationType.system_message,
        title:
          status === AccessRequestStatus.approved
            ? "Заявка одобрена"
            : "Заявка отклонена",
        body:
          status === AccessRequestStatus.approved
            ? `Доступ к курсу "${requestCourse.title}" одобрен преподавателем.`
            : `Заявка на курс "${requestCourse.title}" отклонена преподавателем.`,
        targetRole: NotificationTargetRole.student,
        userId: requestStudent.id,
      },
    });

    return updated;
  });

  return { request: updatedRequest };
}

export async function teacherCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(
    currentUser.role === UserRole.teacher ||
      currentUser.role === UserRole.admin,
    403,
    "Операция недоступна",
  );

  const courses = await lmsRepository.prisma.course.findMany({
    where:
      currentUser.role === UserRole.admin
        ? undefined
        : { teacherId: currentUser.id },
    include: {
      _count: {
        select: {
          enrollments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    courses: courses.map((item) => ({
      ...item,
      modules: readModules(item.modules),
      studentsCount: item._count.enrollments,
    })),
  };
}

export async function teacherCreateCourseShareInvite(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, teacherId: true },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const inviteToken = createCourseInviteToken({
    courseId: course.id,
    teacherId: currentUser.id,
  });
  const verifiedInvite = verifyCourseInviteToken(inviteToken);

  return {
    message: "Успешно",
    course: {
      id: course.id,
      title: course.title,
    },
    inviteToken,
    expiresAt: verifiedInvite?.expiresAt ?? null,
  };
}

export async function teacherCreateCourse(
  userId: string | undefined,
  input: {
    title?: string;
    name?: string;
    category?: string;
    description?: string;
    level?: unknown;
    publishNow?: unknown;
    initialLessons?: unknown;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedTitle = (input.title ?? input.name ?? "").trim();
  const normalizedDescription = (input.description ?? "").trim();
  const normalizedCategory = (input.category ?? "General").trim() || "General";
  const normalizedLevel =
    typeof input.level === "string"
      ? input.level.trim().toLowerCase()
      : CourseLevel.beginner;

  ensure(normalizedTitle, 400, "Некорректный запрос");
  ensure(normalizedDescription, 400, "Некорректный запрос");
  ensure(isCourseLevel(normalizedLevel), 400, "Операция недоступна");

  const publishNow = input.publishNow === true;
  const initialLessonsRaw = Array.isArray(input.initialLessons)
    ? input.initialLessons
    : [];

  const initialLessons = initialLessonsRaw
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const title = asString(item.title).trim();
      if (!title) {
        return null;
      }

      return {
        title,
        description: asString(item.description).trim() || null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item, index, array) => {
      const normalized = item.title.toLowerCase();
      return (
        array.findIndex(
          (candidate) => candidate.title.toLowerCase() === normalized,
        ) === index
      );
    })
    .slice(0, 25);

  const initialLessonModules = initialLessons.map((lesson) => ({
    id: makeEntityId("lesson"),
    type: "lesson",
    title: lesson.title,
    description: lesson.description,
    isVisibleToStudents: false,
    createdAt: new Date().toISOString(),
    materials: [] as Record<string, unknown>[],
  }));

  const created = await lmsRepository.prisma.course.create({
    data: {
      id: await lmsRepository.nextCourseId(),
      title: normalizedTitle,
      category: normalizedCategory,
      description: normalizedDescription,
      level: normalizedLevel,
      isPublished: publishNow,
      progress: 0,
      modules: initialLessonModules as Prisma.InputJsonValue,
      teacherId: currentUser.id,
    },
  });

  const lessonCount = initialLessonModules.length;

  return {
    message: publishNow ? `Действие выполнено.` : `Действие выполнено.`,
    course: {
      ...created,
      modules: readModules(created.modules),
    },
  };
}

export async function teacherSetCourseVisibility(
  userId: string | undefined,
  courseId: string,
  isPublished?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");
  ensure(typeof isPublished === "boolean", 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { isPublished },
  });

  if (isPublished && !course.isPublished) {
    await notifyStudentsAboutPublishedCourse({
      courseId: updated.id,
      courseTitle: updated.title,
    });
  }

  return {
    message: isPublished ? "Enabled" : "Disabled",
    course: {
      ...updated,
      modules: readModules(updated.modules),
    },
  };
}

export async function teacherCompleteCourse(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");
  ensure(course.isPublished, 409, "Курс уже завершен");

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      isPublished: false,
      progress: Math.max(course.progress, 100),
    },
  });

  await notifyStudentsAboutCompletedCourse({
    courseId: updated.id,
    courseTitle: updated.title,
  });

  return {
    message: "Курс завершен",
    course: {
      ...updated,
      modules: readModules(updated.modules),
    },
  };
}

export async function teacherUpdateCourse(
  userId: string | undefined,
  courseId: string,
  input: {
    title?: string;
    category?: string;
    description?: string;
    level?: unknown;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  if (typeof input.title === "string") {
    ensure(input.title.trim(), 400, "Некорректный запрос");
  }
  if (typeof input.description === "string") {
    ensure(input.description.trim(), 400, "Некорректный запрос");
  }
  if (typeof input.category === "string") {
    ensure(input.category.trim(), 400, "Некорректный запрос");
  }

  const normalizedLevel =
    typeof input.level === "string"
      ? input.level.trim().toLowerCase()
      : undefined;
  if (typeof normalizedLevel !== "undefined") {
    ensure(isCourseLevel(normalizedLevel), 400, "Операция недоступна");
  }

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      title: typeof input.title === "string" ? input.title.trim() : undefined,
      category:
        typeof input.category === "string" ? input.category.trim() : undefined,
      description:
        typeof input.description === "string"
          ? input.description.trim()
          : undefined,
      level:
        typeof normalizedLevel === "string" && isCourseLevel(normalizedLevel)
          ? normalizedLevel
          : undefined,
    },
  });

  return {
    message: "Успешно",
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherDeleteCourse(
  userId: string | undefined,
  courseId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  await lmsRepository.prisma.course.delete({ where: { id: courseId } });

  return {
    message: "Успешно",
    course: { ...course, modules: readModules(course.modules) },
  };
}

async function nextAssignmentId() {
  const all = await lmsRepository.prisma.assignment.findMany({
    select: { id: true },
  });
  const maxValue = all.reduce((acc, item) => {
    const value = Number.parseInt(item.id.replace(/^a/, ""), 10);
    return Number.isNaN(value) ? acc : Math.max(acc, value);
  }, 0);
  return `a${maxValue + 1}`;
}

async function nextGradeId() {
  const all = await lmsRepository.prisma.grade.findMany({
    select: { id: true },
  });
  const maxValue = all.reduce((acc, item) => {
    const value = Number.parseInt(item.id.replace(/^g/, ""), 10);
    return Number.isNaN(value) ? acc : Math.max(acc, value);
  }, 0);
  return `g${maxValue + 1}`;
}

async function nextSubmissionId() {
  const all = await lmsRepository.prisma.submission.findMany({
    select: { id: true },
  });
  const maxValue = all.reduce((acc, item) => {
    const value = Number.parseInt(item.id.replace(/^s/, ""), 10);
    return Number.isNaN(value) ? acc : Math.max(acc, value);
  }, 0);
  return `s${maxValue + 1}`;
}

type SubmissionAttachmentPayload = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

type LessonMaterialFilePayload = {
  name: string;
  type: string;
  size: number;
  dataBase64: string;
};

type SubmissionContentPayload = {
  text: string;
  formula: string;
  code: string;
  attachments: SubmissionAttachmentPayload[];
};

const MAX_ATTACHMENT_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENTS_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_LESSON_MATERIAL_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function normalizeBase64Data(value: string) {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIndex >= 0) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

function estimateBase64DecodedBytes(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized) return 0;
  const padding = normalized.endsWith("==")
    ? 2
    : normalized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function normalizeLessonMaterialFile(
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

function parseStoredSubmissionContent(
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

function normalizeSubmissionInput(
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
  const rawAttachments = Array.isArray(raw.attachments) ? raw.attachments : [];

  return {
    text:
      asString(raw.content).trim() ||
      (!attachmentsProvided ? fallback.text : ""),
    formula:
      asString(raw.formula).trim() ||
      (!attachmentsProvided ? fallback.formula : ""),
    code:
      asString(raw.code).trim() || (!attachmentsProvided ? fallback.code : ""),
    attachments: attachmentsProvided
      ? rawAttachments
          .filter(isRecord)
          .map((item) => ({
            name: asString(item.name).trim(),
            type: asString(item.type).trim() || "application/octet-stream",
            size: Number(item.size) || 0,
            dataBase64: asString(item.dataBase64).trim(),
          }))
          .filter((item) => item.name && item.dataBase64)
      : fallback.attachments,
  };
}

function sanitizeSubmissionForResponse(payload: SubmissionContentPayload) {
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

export async function teacherCreateAssignment(
  userId: string | undefined,
  courseId: string,
  input: {
    title?: string;
    description?: string;
    dueAt?: string;
    lessonId?: string;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const normalizedTitle = (input.title ?? "").trim();
  const normalizedLessonId = (input.lessonId ?? "").trim();
  ensure(normalizedTitle, 400, "Некорректный запрос");
  ensure(normalizedLessonId, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, normalizedLessonId);
  ensure(lessonIndex >= 0, 400, "Некорректный запрос");

  const parsedDueAt = input.dueAt ? new Date(input.dueAt) : undefined;
  if (parsedDueAt) {
    ensure(!Number.isNaN(parsedDueAt.getTime()), 400, "Операция недоступна");
  }

  const assignment = await lmsRepository.prisma.assignment.create({
    data: {
      id: await nextAssignmentId(),
      title: normalizedTitle,
      description: (input.description ?? "").trim() || null,
      dueAt: parsedDueAt,
      courseId,
      lessonId: normalizedLessonId,
    },
  });

  const lessonVisibleToStudents =
    modules[lessonIndex]?.isVisibleToStudents !== false;
  if (course.isPublished && lessonVisibleToStudents) {
    await notifyStudentsAboutNewAssignment({
      courseId: course.id,
      courseTitle: course.title,
      assignmentTitle: assignment.title,
      dueAt: parsedDueAt,
    });
  }

  return { message: "Успешно", assignment };
}

export async function teacherUpdateAssignmentDeadline(
  userId: string | undefined,
  assignmentId: string,
  dueAt?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  ensure(assignment, 404, "Ресурс не найден");
  ensure(
    assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );
  ensure(dueAt && dueAt.trim(), 400, "Некорректный запрос");

  const parsedDueAt = new Date(dueAt);
  ensure(!Number.isNaN(parsedDueAt.getTime()), 400, "Операция недоступна");

  const updated = await lmsRepository.prisma.assignment.update({
    where: { id: assignmentId },
    data: { dueAt: parsedDueAt },
  });

  return { message: "Успешно", assignment: updated };
}

export async function teacherUploadMaterial(
  userId: string | undefined,
  courseId: string,
  input: { name?: string; url?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const materialName = (input.name ?? "").trim();
  ensure(materialName, 400, "Некорректный запрос");

  const modules = readModules(course.modules);
  const nextModules = [
    ...modules,
    {
      type: "material",
      name: materialName,
      url: (input.url ?? "").trim() || null,
      createdAt: new Date().toISOString(),
    },
  ];

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules },
  });

  return {
    message: "Успешно",
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherCreateLesson(
  userId: string | undefined,
  courseId: string,
  input: { title?: string; description?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const title = (input.title ?? "").trim();
  ensure(title, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const duplicateExists = modules.some((item) => {
    const type = asString(item.type).toLowerCase();
    if (type !== "lesson") return false;
    return asString(item.title).trim().toLowerCase() === title.toLowerCase();
  });
  ensure(!duplicateExists, 409, "Конфликт данных");

  const lesson = {
    id: makeEntityId("lesson"),
    type: "lesson",
    title,
    description:
      (input.description ?? "").trim().length > 0
        ? (input.description ?? "")
        : null,
    isVisibleToStudents: false,
    createdAt: new Date().toISOString(),
    materials: [] as Record<string, unknown>[],
  };

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: {
      modules: [...modules, lesson] as Prisma.InputJsonValue,
    },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherUpdateLesson(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  input: { title?: string; description?: string },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const normalizedTitle = (input.title ?? "").trim();
  ensure(normalizedTitle, 400, "Некорректный запрос");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const duplicateExists = modules.some((item, index) => {
    if (index === lessonIndex) return false;
    const type = asString(item.type).toLowerCase();
    if (type !== "lesson") return false;
    return (
      asString(item.title).trim().toLowerCase() ===
      normalizedTitle.toLowerCase()
    );
  });
  ensure(!duplicateExists, 409, "Конфликт данных");

  const lesson = {
    ...modules[lessonIndex],
    title: normalizedTitle,
    description:
      (input.description ?? "").trim().length > 0
        ? (input.description ?? "")
        : null,
    updatedAt: new Date().toISOString(),
  };

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherDeleteLesson(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const deletedLesson = modules[lessonIndex];
  const nextModules = modules.filter((item) => asString(item.id) !== lessonId);

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson: deletedLesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherReorderLessons(
  userId: string | undefined,
  courseId: string,
  lessonIds?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  ensure(Array.isArray(lessonIds), 400, "Некорректный запрос");

  const normalizedLessonIds = lessonIds
    .map((item) => asString(item).trim())
    .filter((item) => item.length > 0);

  const modules = asModuleRecordArray(course.modules);
  const lessonModules = modules.filter(
    (item) => asString(item.type).toLowerCase() === "lesson",
  );
  const nonLessonModules = modules.filter(
    (item) => asString(item.type).toLowerCase() !== "lesson",
  );

  ensure(
    normalizedLessonIds.length === lessonModules.length,
    400,
    "Некорректный запрос",
  );

  const lessonById = new Map(
    lessonModules.map((item) => [asString(item.id).trim(), item]),
  );

  const uniqueLessonIds = new Set(normalizedLessonIds);
  ensure(
    uniqueLessonIds.size === normalizedLessonIds.length,
    400,
    "Конфликт данных",
  );

  const reorderedLessons = normalizedLessonIds.map((lessonId) => {
    const lesson = lessonById.get(lessonId);
    ensure(lesson, 400, "Некорректный запрос");
    return lesson;
  });

  const nextModules = [...reorderedLessons, ...nonLessonModules].map(
    (item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
    }),
  );

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherAddLessonMaterial(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  input: {
    type?: string;
    title?: string;
    text?: string;
    url?: string;
    table?: string;
    formula?: string;
    code?: string;
    file?: unknown;
  },
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = { ...modules[lessonIndex] };
  const materialType = (input.type ?? "material").trim().toLowerCase();
  const title = (input.title ?? "").trim();
  const rawText = input.text ?? "";
  const text = rawText.trim();
  const url = (input.url ?? "").trim();
  const table = (input.table ?? "").trim();
  const formula = (input.formula ?? "").trim();
  const code = (input.code ?? "").trim();
  const file = normalizeLessonMaterialFile(input.file);
  const hasFile = file !== null;

  ensure(title, 400, "Некорректный запрос");
  ensure(
    text || url || table || formula || code || hasFile,
    400,
    "Операция недоступна",
  );

  if (file) {
    ensure(
      file.size > 0 && file.size <= MAX_LESSON_MATERIAL_FILE_SIZE_BYTES,
      400,
      `Действие выполнено`,
    );
  }

  const currentMaterials = Array.isArray(lesson.materials)
    ? lesson.materials.filter((item): item is Record<string, unknown> =>
        isRecord(item),
      )
    : [];

  const material = {
    id: makeEntityId("mat"),
    type: materialType,
    title,
    text: text ? rawText : null,
    url: url || null,
    table: table || null,
    formula: formula || null,
    code: code || null,
    file,
    createdAt: new Date().toISOString(),
  };

  lesson.materials = [...currentMaterials, material];

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    material,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherDeleteLessonMaterial(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  materialId: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedMaterialId = materialId.trim();
  ensure(normalizedMaterialId, 400, "Некорректный запрос");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = { ...modules[lessonIndex] };
  const currentMaterials = Array.isArray(lesson.materials)
    ? lesson.materials.filter((item): item is Record<string, unknown> =>
        isRecord(item),
      )
    : [];

  const nextMaterials = currentMaterials.filter(
    (item) => asString(item.id) !== normalizedMaterialId,
  );
  ensure(
    nextMaterials.length !== currentMaterials.length,
    404,
    "Ресурс не найден",
  );

  lesson.materials = nextMaterials;
  lesson.updatedAt = new Date().toISOString();

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: "Успешно",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherSetLessonVisibility(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  isVisibleToStudents?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");
  ensure(typeof isVisibleToStudents === "boolean", 400, "Операция недоступна");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: courseId },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");

  const modules = asModuleRecordArray(course.modules);
  const lessonIndex = findLessonIndex(modules, lessonId);
  ensure(lessonIndex >= 0, 404, "Ресурс не найден");

  const lesson = {
    ...modules[lessonIndex],
    isVisibleToStudents,
    updatedAt: new Date().toISOString(),
  };

  const nextModules = [...modules];
  nextModules[lessonIndex] = lesson;

  const updated = await lmsRepository.prisma.course.update({
    where: { id: courseId },
    data: { modules: nextModules as Prisma.InputJsonValue },
  });

  return {
    message: isVisibleToStudents ? "Enabled" : "Disabled",
    lesson,
    course: { ...updated, modules: readModules(updated.modules) },
  };
}

export async function teacherMessageStudent(
  userId: string | undefined,
  courseId: string,
  studentId: string,
  message?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const [course, student] = await Promise.all([
    lmsRepository.prisma.course.findUnique({ where: { id: courseId } }),
    lmsRepository.prisma.user.findUnique({ where: { id: studentId } }),
  ]);

  ensure(course, 404, "Ресурс не найден");
  ensure(course.teacherId === currentUser.id, 403, "Операция недоступна");
  ensure(
    student && student.role === UserRole.student,
    404,
    "Операция недоступна",
  );

  return sendMessage(currentUser.id, { toUserId: studentId, message });
}

export async function teacherCommentSubmission(
  userId: string | undefined,
  submissionId: string,
  comment?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const normalizedComment = (comment ?? "").trim();
  ensure(normalizedComment, 400, "Некорректный запрос");

  const submission = await lmsRepository.prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: { include: { course: true } },
      grade: true,
    },
  });
  ensure(submission, 404, "Ресурс не найден");
  ensure(
    submission.assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );

  const grade = submission.grade
    ? await lmsRepository.prisma.grade.update({
        where: { submissionId: submission.id },
        data: { feedback: normalizedComment, gradedById: currentUser.id },
      })
    : await lmsRepository.prisma.grade.create({
        data: {
          id: await nextGradeId(),
          submissionId: submission.id,
          gradedById: currentUser.id,
          feedback: normalizedComment,
          score: null,
        },
      });

  return { message: "Успешно", grade };
}

export async function teacherGradeSubmission(
  userId: string | undefined,
  submissionId: string,
  score?: unknown,
  feedback?: string,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");
  ensure(typeof score !== "undefined", 400, "Некорректный запрос");

  const scoreValue = Number(score);
  ensure(Number.isFinite(scoreValue), 400, "Некорректный запрос");
  ensure(scoreValue >= 0 && scoreValue <= 100, 400, "Операция недоступна");

  const submission = await lmsRepository.prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: { include: { course: true } },
      grade: true,
    },
  });
  ensure(submission, 404, "Ресурс не найден");
  ensure(
    submission.assignment.course.teacherId === currentUser.id,
    403,
    "Операция недоступна",
  );

  const normalizedFeedback = (feedback ?? "").trim() || null;

  const grade = submission.grade
    ? await lmsRepository.prisma.grade.update({
        where: { submissionId: submission.id },
        data: {
          score: scoreValue,
          feedback: normalizedFeedback,
          gradedById: currentUser.id,
        },
      })
    : await lmsRepository.prisma.grade.create({
        data: {
          id: await nextGradeId(),
          submissionId: submission.id,
          gradedById: currentUser.id,
          score: scoreValue,
          feedback: normalizedFeedback,
        },
      });

  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.grade_posted,
      title: "Оценка опубликована",
      body: `По заданию "${submission.assignment.title}" в курсе "${submission.assignment.course.title}" выставлена оценка: ${scoreValue}.`,
      targetRole: NotificationTargetRole.student,
      userId: submission.studentId,
    },
  });

  return { message: "Успешно", grade };
}

export async function teacherGradesOverview(userId: string | undefined) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const submissions = await lmsRepository.prisma.submission.findMany({
    where: {
      assignment: {
        course: {
          teacherId: currentUser.id,
        },
      },
    },
    include: {
      student: {
        select: { id: true, fullName: true, email: true, role: true },
      },
      assignment: {
        include: {
          course: {
            select: { id: true, title: true },
          },
        },
      },
      grade: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  return {
    rows: submissions.map((item) => {
      const payload = parseStoredSubmissionContent(item.content);

      return {
        submissionId: item.id,
        studentId: item.studentId,
        studentName: item.student.fullName,
        studentEmail: item.student.email,
        assignmentId: item.assignmentId,
        assignmentTitle: item.assignment.title,
        courseId: item.assignment.course.id,
        courseTitle: item.assignment.course.title,
        score: item.grade?.score ?? null,
        feedback: item.grade?.feedback ?? null,
        submittedAt: item.submittedAt,
        answerText: payload.text,
        answerFormula: payload.formula,
        answerCode: payload.code,
        answerAttachments: payload.attachments.map((attachment) => ({
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          dataBase64: attachment.dataBase64,
        })),
      };
    }),
  };
}

export async function teacherDashboardOverview(userId: string | undefined) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.teacher, 403, "Доступ запрещен");

  const courses = await lmsRepository.prisma.course.findMany({
    where: { teacherId: currentUser.id },
    select: {
      id: true,
      title: true,
      category: true,
      progress: true,
      isPublished: true,
      createdAt: true,
      modules: true,
      updatedAt: true,
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const courseIds = courses.map((item) => item.id);

  const [pendingRequests, studentsEnrolled, assignmentsToGrade] =
    await Promise.all([
      lmsRepository.prisma.accessRequest.count({
        where: {
          teacherId: currentUser.id,
          status: AccessRequestStatus.pending,
        },
      }),
      lmsRepository.prisma.enrollment.count({
        where: {
          courseId: { in: courseIds.length ? courseIds : ["__none__"] },
        },
      }),
      lmsRepository.prisma.submission.count({
        where: {
          assignment: {
            course: {
              teacherId: currentUser.id,
            },
          },
          grade: null,
        },
      }),
    ]);

  return {
    summary: {
      courses: courses.length,
      assignmentsToGrade,
      studentsEnrolled,
      pendingRequests,
    },
    courses: courses.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      progress: item.progress,
      isPublished: item.isPublished,
      createdAt: item.createdAt.toISOString(),
      modules: item.modules,
      studentsCount: item._count.enrollments,
    })),
  };
}

export async function studentDashboardOverview(userId: string | undefined) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: {
      studentId: currentUser.id,
      course: {
        OR: [{ isPublished: true }, { progress: { gte: 100 } }],
      },
    },
    include: {
      course: {
        include: {
          teacher: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const courseIds = enrollments.map((item) => item.courseId);

  const progressByCourseId = new Map<string, StudentLessonProgressSummary>();
  await Promise.all(
    enrollments.map(async (item) => {
      const progress = await getStudentLessonProgress({
        courseId: item.course.id,
        studentId: currentUser.id,
        modules: item.course.modules,
      });
      progressByCourseId.set(item.course.id, progress);
    }),
  );

  const assignments = await lmsRepository.prisma.assignment.findMany({
    where: {
      courseId: { in: courseIds.length ? courseIds : ["__none__"] },
      course: { isPublished: true },
    },
    include: {
      course: {
        select: { id: true, title: true, modules: true },
      },
      submissions: {
        where: { studentId: currentUser.id },
        include: { grade: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const visibleAssignments = assignments.filter((item) =>
    isAssignmentVisibleToStudents(item.course.modules, item.lessonId),
  );

  const targetRole = NotificationTargetRole.student;
  const notifications = await lmsRepository.prisma.notification.findMany({
    where: {
      OR: [{ userId: null }, { userId: currentUser.id }],
      AND: [
        { OR: [{ targetRole: NotificationTargetRole.all }, { targetRole }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const now = new Date();
  const soonDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const assignmentItems = visibleAssignments.map((item) => {
    const ownSubmission = item.submissions[0];
    const dueAt = item.dueAt;
    const dueSoon =
      !!dueAt &&
      dueAt.getTime() >= now.getTime() &&
      dueAt.getTime() <= soonDate.getTime() &&
      !ownSubmission;

    return {
      id: item.id,
      title: item.title,
      course: item.course.title,
      dueDate: dueAt ? dueAt.toISOString() : null,
      status: ownSubmission ? "Enabled" : "Disabled",
      dueSoon,
    };
  });

  const grades = visibleAssignments
    .flatMap((item) =>
      item.submissions
        .filter((submission) => submission.grade?.score !== null)
        .map((submission) => ({
          id: submission.id,
          assignment: sanitizeStudentFacingText(item.title),
          course: item.course.title,
          grade: submission.grade?.score
            ? Number(submission.grade.score)
            : null,
          comment: submission.grade?.feedback ?? null,
          createdAt: submission.submittedAt.toISOString(),
        })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const gpa =
    grades.length > 0
      ? Number(
          (
            grades.reduce((acc, item) => acc + (item.grade ?? 0), 0) /
            grades.length /
            25
          ).toFixed(2),
        )
      : 0;

  return {
    summary: {
      courses: enrollments.length,
      assignments: assignmentItems.length,
      dueSoon: assignmentItems.some((item) => item.dueSoon),
      gpa,
    },
    currentCourses: enrollments.map((item) => {
      const calculatedProgress =
        progressByCourseId.get(item.course.id)?.progressPercent ?? 0;
      const completedByTeacher =
        !item.course.isPublished && item.course.progress >= 100;
      const isCompleted = completedByTeacher || calculatedProgress >= 100;

      return {
        progress: calculatedProgress,
        id: item.course.id,
        name: item.course.title,
        teacher: item.course.teacher.fullName,
        status: isCompleted ? "Enabled" : "Disabled",
        completedByTeacher,
      };
    }),
    assignments: assignmentItems,
    recentGrades: grades.slice(0, 5),
    announcements: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      text: item.body,
      date: item.createdAt.toISOString(),
    })),
  };
}

export async function studentCourses(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const enrollments = await lmsRepository.prisma.enrollment.findMany({
    where: {
      studentId: currentUser.id,
      course: {
        OR: [{ isPublished: true }, { progress: { gte: 100 } }],
      },
    },
    include: { course: true },
    orderBy: { createdAt: "desc" },
  });

  const courses = await Promise.all(
    enrollments.map(async (item) => {
      const studentProgress = await getStudentLessonProgress({
        courseId: item.course.id,
        studentId: currentUser.id,
        modules: item.course.modules,
      });

      return {
        ...item.course,
        modules: readModules(item.course.modules),
        progress: studentProgress.progressPercent,
        completedByTeacher:
          !item.course.isPublished && item.course.progress >= 100,
        studentProgress,
      };
    }),
  );

  return { courses };
}

export async function studentSetLessonCompletion(
  userId: string | undefined,
  courseId: string,
  lessonId: string,
  completed?: boolean,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const normalizedCourseId = asString(courseId).trim();
  const normalizedLessonId = asString(lessonId).trim();
  ensure(normalizedCourseId, 400, "Некорректный запрос");
  ensure(normalizedLessonId, 400, "Некорректный запрос");

  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId: normalizedCourseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });
  ensure(enrollment, 403, "Доступ запрещен");

  const course = await lmsRepository.prisma.course.findUnique({
    where: { id: normalizedCourseId },
    select: { id: true, modules: true, isPublished: true, progress: true },
  });
  ensure(course, 404, "Ресурс не найден");
  ensure(
    course.isPublished,
    403,
    course.progress >= 100
      ? "Курс завершен. Доступен только просмотр."
      : "Доступ запрещен",
  );

  const visibleLessonIds = readVisibleLessonIds(course.modules);
  ensure(
    visibleLessonIds.includes(normalizedLessonId),
    404,
    "Операция недоступна",
  );

  const shouldMarkCompleted = completed !== false;
  if (shouldMarkCompleted) {
    await lmsRepository.prisma.studentLessonProgress.upsert({
      where: {
        courseId_studentId_lessonId: {
          courseId: normalizedCourseId,
          studentId: currentUser.id,
          lessonId: normalizedLessonId,
        },
      },
      create: {
        id: makeEntityId("slp"),
        courseId: normalizedCourseId,
        studentId: currentUser.id,
        lessonId: normalizedLessonId,
        completedAt: new Date(),
      },
      update: {
        completedAt: new Date(),
      },
    });
  } else {
    await lmsRepository.prisma.studentLessonProgress.deleteMany({
      where: {
        courseId: normalizedCourseId,
        studentId: currentUser.id,
        lessonId: normalizedLessonId,
      },
    });
  }

  const studentProgress = await getStudentLessonProgress({
    courseId: normalizedCourseId,
    studentId: currentUser.id,
    modules: course.modules,
  });

  return {
    message: shouldMarkCompleted ? "Enabled" : "Disabled",
    studentProgress,
  };
}

export async function studentAssignments(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const assignments = await lmsRepository.prisma.assignment.findMany({
    where: {
      course: {
        OR: [{ isPublished: true }, { progress: { gte: 100 } }],
        enrollments: {
          some: { studentId: currentUser.id },
        },
      },
    },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          modules: true,
          isPublished: true,
          progress: true,
          teacherId: true,
          teacher: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      },
      submissions: {
        where: { studentId: currentUser.id },
        include: { grade: true },
        orderBy: { submittedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const visibleAssignments = assignments.filter((item) =>
    isAssignmentVisibleToStudents(item.course.modules, item.lessonId),
  );

  return {
    assignments: visibleAssignments.map((item) => {
      const ownSubmission = item.submissions[0] ?? null;
      const parsedSubmission = ownSubmission
        ? parseStoredSubmissionContent(ownSubmission.content)
        : null;

      return {
        id: item.id,
        title: sanitizeStudentFacingText(item.title),
        description: item.description,
        lessonId: item.lessonId,
        lessonTitle: readLessonTitleById(item.course.modules, item.lessonId),
        dueAt: item.dueAt?.toISOString() ?? null,
        course: {
          id: item.course.id,
          title: item.course.title,
          teacher: item.course.teacher.fullName,
          completedByTeacher:
            !item.course.isPublished && item.course.progress >= 100,
        },
        submission: ownSubmission
          ? {
              id: ownSubmission.id,
              ...sanitizeSubmissionForResponse(
                parsedSubmission ?? {
                  text: "",
                  formula: "",
                  code: "",
                  attachments: [],
                },
              ),
              submittedAt: ownSubmission.submittedAt.toISOString(),
              grade:
                ownSubmission.grade?.score !== null &&
                ownSubmission.grade?.score
                  ? Number(ownSubmission.grade.score)
                  : null,
              feedback: ownSubmission.grade?.feedback ?? null,
            }
          : null,
      };
    }),
  };
}

export async function studentSubmitAssignment(
  userId: string | undefined,
  assignmentId: string,
  input?: unknown,
) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      course: {
        include: {
          teacher: {
            select: { id: true, fullName: true },
          },
        },
      },
    },
  });

  ensure(assignment, 404, "Ресурс не найден");

  const enrollment = await lmsRepository.prisma.enrollment.findUnique({
    where: {
      courseId_studentId: {
        courseId: assignment.courseId,
        studentId: currentUser.id,
      },
    },
    select: { id: true },
  });
  ensure(enrollment, 403, "Доступ запрещен");
  ensure(
    assignment.course.isPublished,
    403,
    assignment.course.progress >= 100
      ? "Курс завершен. Доступен только просмотр."
      : "Операция недоступна",
  );
  ensure(
    isAssignmentVisibleToStudents(
      assignment.course.modules,
      assignment.lessonId,
    ),
    403,
    "Операция недоступна",
  );
  ensure(
    !assignment.dueAt || new Date() <= assignment.dueAt,
    403,
    "Операция недоступна",
  );

  const existingSubmission = await lmsRepository.prisma.submission.findFirst({
    where: {
      assignmentId,
      studentId: currentUser.id,
    },
    orderBy: { submittedAt: "desc" },
  });

  const fallbackPayload = existingSubmission
    ? parseStoredSubmissionContent(existingSubmission.content)
    : { text: "", formula: "", code: "", attachments: [] };
  const submissionPayload = normalizeSubmissionInput(input, fallbackPayload);

  ensure(
    submissionPayload.text ||
      submissionPayload.formula ||
      submissionPayload.code ||
      submissionPayload.attachments.length > 0,
    400,
    "Операция недоступна",
  );

  let totalAttachmentsSize = 0;
  for (const attachment of submissionPayload.attachments) {
    ensure(
      attachment.size > 0 && attachment.size <= MAX_ATTACHMENT_SIZE_BYTES,
      400,
      `Действие выполнено`,
    );
    totalAttachmentsSize += attachment.size;
  }
  ensure(
    totalAttachmentsSize <= MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
    400,
    "Операция недоступна",
  );

  const serializedSubmissionContent = JSON.stringify(submissionPayload);

  const submittedAt = new Date();
  const submission = existingSubmission
    ? await lmsRepository.prisma.submission.update({
        where: { id: existingSubmission.id },
        data: {
          content: serializedSubmissionContent,
          submittedAt,
        },
      })
    : await lmsRepository.prisma.submission.create({
        data: {
          id: await nextSubmissionId(),
          assignmentId,
          studentId: currentUser.id,
          content: serializedSubmissionContent,
          submittedAt,
        },
      });

  await lmsRepository.prisma.notification.create({
    data: {
      id: await lmsRepository.nextNotificationId(),
      type: NotificationType.system_message,
      title: "Новая сдача задания",
      body: `Студент ${currentUser.fullName} отправил решение по заданию "${assignment.title}" в курсе "${assignment.course.title}".`,
      targetRole: NotificationTargetRole.teacher,
      userId: assignment.course.teacherId,
    },
  });

  return {
    message: "Успешно",
    submission: {
      id: submission.id,
      submittedAt: submission.submittedAt.toISOString(),
      ...sanitizeSubmissionForResponse(submissionPayload),
    },
  };
}

export async function studentGradesOverview(userId?: string) {
  const currentUser = await requireCurrentUser(userId);
  ensure(currentUser.role === UserRole.student, 403, "Доступ запрещен");

  const submissions = await lmsRepository.prisma.submission.findMany({
    where: { studentId: currentUser.id },
    include: {
      assignment: {
        include: {
          course: {
            include: {
              teacher: {
                select: { id: true, fullName: true },
              },
            },
          },
        },
      },
      grade: true,
    },
    orderBy: { submittedAt: "desc" },
  });

  const assignmentGrades = submissions
    .filter((item) => item.grade?.score !== null)
    .map((item) => ({
      submissionId: item.id,
      assignmentId: item.assignmentId,
      assignmentTitle: sanitizeStudentFacingText(item.assignment.title),
      courseId: item.assignment.course.id,
      courseTitle: item.assignment.course.title,
      teacherName: item.assignment.course.teacher.fullName,
      score: item.grade?.score ? Number(item.grade.score) : null,
      feedback: item.grade?.feedback ?? null,
      submittedAt: item.submittedAt.toISOString(),
      gradedAt: item.grade?.createdAt.toISOString() ?? null,
    }));

  const courseStatsMap = new Map<
    string,
    {
      courseId: string;
      courseTitle: string;
      teacherName: string;
      assignmentsSubmitted: number;
      assignmentsGraded: number;
      totalScore: number;
      maxScore: number;
      minScore: number;
    }
  >();

  for (const submission of submissions) {
    const courseId = submission.assignment.course.id;
    const current = courseStatsMap.get(courseId) ?? {
      courseId,
      courseTitle: submission.assignment.course.title,
      teacherName: submission.assignment.course.teacher.fullName,
      assignmentsSubmitted: 0,
      assignmentsGraded: 0,
      totalScore: 0,
      maxScore: 0,
      minScore: 100,
    };

    current.assignmentsSubmitted += 1;

    if (submission.grade?.score !== null && submission.grade?.score) {
      const score = Number(submission.grade.score);
      current.assignmentsGraded += 1;
      current.totalScore += score;
      current.maxScore = Math.max(current.maxScore, score);
      current.minScore = Math.min(current.minScore, score);
    }

    courseStatsMap.set(courseId, current);
  }

  const courseStats = Array.from(courseStatsMap.values()).map((item) => ({
    courseId: item.courseId,
    courseTitle: item.courseTitle,
    teacherName: item.teacherName,
    assignmentsSubmitted: item.assignmentsSubmitted,
    assignmentsGraded: item.assignmentsGraded,
    averageScore:
      item.assignmentsGraded > 0
        ? Number((item.totalScore / item.assignmentsGraded).toFixed(2))
        : null,
    maxScore: item.assignmentsGraded > 0 ? item.maxScore : null,
    minScore: item.assignmentsGraded > 0 ? item.minScore : null,
  }));

  const gradedScores = assignmentGrades
    .map((item) => item.score)
    .filter((item): item is number => item !== null);

  return {
    summary: {
      assignmentsSubmitted: submissions.length,
      assignmentsGraded: gradedScores.length,
      averageScore:
        gradedScores.length > 0
          ? Number(
              (
                gradedScores.reduce((acc, value) => acc + value, 0) /
                gradedScores.length
              ).toFixed(2),
            )
          : null,
      bestScore: gradedScores.length > 0 ? Math.max(...gradedScores) : null,
      worstScore: gradedScores.length > 0 ? Math.min(...gradedScores) : null,
    },
    courseStats,
    assignmentGrades,
  };
}
