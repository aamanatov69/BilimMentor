import { UserRole, CourseLevel, AccessRequestStatus, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { lmsRepository } from "../repositories/lmsRepository";
import { ensure, HttpError } from "../utils/httpError";
import {
  isUserRole,
  isCourseLevel,
  isAccessRequestStatus,
  userPublic,
  readModules,
  makeEntityId,
  asModuleRecordArray,
  findLessonIndex,
  asString,
  isRecord,
  requireCurrentUser,
} from "./shared/serviceHelpers";

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
      assignments: {
        orderBy: { createdAt: "desc" },
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


export async function adminUpdateAssignment(
  assignmentId: string,
  input: {
    title?: string;
    description?: string;
    dueAt?: string | null;
    lessonId?: string;
  },
) {
  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { course: true },
  });
  ensure(assignment, 404, "Ресурс не найден");

  const hasTitle = typeof input.title === "string";
  const hasDescription = typeof input.description === "string";
  const hasDueAt = typeof input.dueAt === "string" || input.dueAt === null;
  const hasLessonId = typeof input.lessonId === "string";

  ensure(
    hasTitle || hasDescription || hasDueAt || hasLessonId,
    400,
    "Некорректный запрос",
  );

  if (hasTitle) {
    ensure(input.title?.trim(), 400, "Некорректный запрос");
  }

  let nextLessonId: string | null | undefined;
  if (hasLessonId) {
    const normalizedLessonId = input.lessonId?.trim() ?? "";
    ensure(normalizedLessonId, 400, "Некорректный запрос");

    const modules = asModuleRecordArray(assignment.course.modules);
    const lessonIndex = findLessonIndex(modules, normalizedLessonId);
    ensure(lessonIndex >= 0, 400, "Некорректный запрос");
    nextLessonId = normalizedLessonId;
  }

  let parsedDueAt: Date | null | undefined;
  if (hasDueAt) {
    const dueAtRaw = typeof input.dueAt === "string" ? input.dueAt.trim() : "";
    if (!dueAtRaw) {
      parsedDueAt = null;
    } else {
      const dueAtValue = new Date(dueAtRaw);
      ensure(!Number.isNaN(dueAtValue.getTime()), 400, "Операция недоступна");
      parsedDueAt = dueAtValue;
    }
  }

  const updated = await lmsRepository.prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      title: hasTitle ? input.title?.trim() : undefined,
      description: hasDescription
        ? input.description?.trim() || null
        : undefined,
      dueAt: hasDueAt ? parsedDueAt : undefined,
      lessonId: hasLessonId ? nextLessonId : undefined,
    },
  });

  return { message: "Успешно", assignment: updated };
}


export async function adminDeleteAssignment(assignmentId: string) {
  const assignment = await lmsRepository.prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  ensure(assignment, 404, "Ресурс не найден");

  await lmsRepository.prisma.assignment.delete({
    where: { id: assignmentId },
  });

  return { message: "Успешно", assignment };
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

